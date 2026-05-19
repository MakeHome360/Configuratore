import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader, Badge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Phone, Mail, MapPin, Calendar, FileText, Hammer, Save, Trash2, MessageSquare, PhoneCall, MailIcon, UserCheck, Edit3 } from "lucide-react";
import { toast } from "sonner";

const STATI = [
  { k: "nuovo", label: "Nuovo", color: "zinc" },
  { k: "contattato", label: "Contattato", color: "blue" },
  { k: "preventivo", label: "Preventivo Inviato", color: "yellow" },
  { k: "vinto", label: "Vinto", color: "green" },
  { k: "perso", label: "Perso", color: "red" },
];

const TIPI_NOTA = [
  { k: "nota", label: "Nota libera", icon: MessageSquare, color: "zinc" },
  { k: "chiamata", label: "Chiamata", icon: PhoneCall, color: "emerald" },
  { k: "email", label: "Email", icon: MailIcon, color: "blue" },
  { k: "meeting", label: "Incontro", icon: UserCheck, color: "purple" },
];

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

export default function LeadDetail() {
  const { lid } = useParams();
  const nav = useNavigate();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [nota, setNota] = useState({ testo: "", tipo: "nota", esito: "" });
  const [savingNota, setSavingNota] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/leads/${lid}`);
      setLead(r.data);
      setForm(r.data);
    } catch (e) {
      toast.error("Lead non trovato");
      nav("/crm");
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [lid]);

  const save = async () => {
    try {
      const r = await api.put(`/leads/${lid}`, form);
      setLead(r.data || form);
      setEditing(false);
      toast.success("Dati salvati");
    } catch (e) { toast.error("Errore salvataggio"); }
  };

  const changeStato = async (stato) => {
    try {
      await api.put(`/leads/${lid}`, { stato });
      setLead({ ...lead, stato });
      setForm({ ...form, stato });
      toast.success(`Stato → ${STATI.find(s => s.k === stato)?.label || stato}`);
    } catch (e) { toast.error("Errore"); }
  };

  const addNota = async () => {
    if (!nota.testo.trim()) return toast.error("Scrivi qualcosa nella nota");
    setSavingNota(true);
    try {
      await api.post(`/leads/${lid}/note`, nota);
      setNota({ testo: "", tipo: "nota", esito: "" });
      toast.success("Nota aggiunta");
      load();
    } catch (e) { toast.error("Errore"); }
    setSavingNota(false);
  };

  const delNota = async (nid) => {
    if (!window.confirm("Eliminare nota?")) return;
    await api.delete(`/leads/${lid}/note/${nid}`);
    load();
  };

  const del = async () => {
    if (!window.confirm(`Eliminare definitivamente il lead "${lead?.nome}"?`)) return;
    await api.delete(`/leads/${lid}`);
    toast.success("Lead eliminato");
    nav("/crm");
  };

  if (loading) return <div className="p-16 text-center mono text-zinc-500">caricamento…</div>;
  if (!lead) return null;

  const nomeFull = `${lead.nome || ""} ${lead.cognome || ""}`.trim() || "Lead senza nome";
  const stato = STATI.find(s => s.k === (lead.stato || "nuovo")) || STATI[0];
  const noteList = lead.note_history || [];

  // Quick action URLs
  const telLink = lead.telefono ? `tel:${(lead.telefono || "").replace(/[^\d+]/g, "")}` : null;
  const waLink = lead.telefono ? `https://wa.me/${(lead.telefono || "").replace(/[^\d]/g, "").replace(/^0/, "39")}` : null;
  const mailLink = lead.email ? `mailto:${lead.email}?subject=Preventivo ristrutturazione` : null;
  const mapLink = (lead.indirizzo || lead.citta) ? `https://www.google.com/maps/search/${encodeURIComponent([lead.indirizzo, lead.citta].filter(Boolean).join(", "))}` : null;

  return (
    <div data-testid="lead-detail-page">
      <PageHeader
        title={nomeFull}
        subtitle={<div className="flex items-center gap-3 mt-1">
          <Badge color={stato.color} data-testid="lead-badge-stato">{stato.label}</Badge>
          {lead.source && <span className="text-xs text-zinc-500">📥 Importato da: <strong>{lead.source}</strong></span>}
          {lead.ultimo_contatto && <span className="text-xs text-zinc-500">· Ultimo contatto: {fmtDate(lead.ultimo_contatto)}</span>}
        </div>}
        actions={<div className="flex gap-2">
          <Button variant="outline" onClick={() => nav("/crm")} data-testid="lead-back" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Torna al CRM</Button>
          {!editing ? (
            <Button variant="outline" onClick={() => setEditing(true)} data-testid="lead-edit-btn" size="sm"><Edit3 className="h-4 w-4 mr-1" />Modifica</Button>
          ) : (
            <Button onClick={save} data-testid="lead-save-btn" size="sm" style={{ background: "var(--brand)", color: "white" }}><Save className="h-4 w-4 mr-1" />Salva</Button>
          )}
        </div>}
      />
      <Page>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* COLONNA 1-2: Dati lead + azioni */}
          <div className="lg:col-span-2 space-y-4">

            {/* Azioni rapide contatto */}
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <div className="text-[11px] uppercase tracking-widest text-zinc-500 font-bold mb-3">Azioni rapide</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <a href={telLink || "#"} onClick={e => !telLink && e.preventDefault()} data-testid="lead-action-call"
                   className={`flex flex-col items-center gap-1 p-3 rounded border ${telLink ? "border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700" : "border-zinc-200 bg-zinc-50 text-zinc-400 cursor-not-allowed"}`}>
                  <Phone className="h-5 w-5" />
                  <span className="text-xs font-semibold">Chiama</span>
                  <span className="text-[10px]">{lead.telefono || "Nessun numero"}</span>
                </a>
                <a href={waLink || "#"} target="_blank" rel="noreferrer" onClick={e => !waLink && e.preventDefault()} data-testid="lead-action-whatsapp"
                   className={`flex flex-col items-center gap-1 p-3 rounded border ${waLink ? "border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700" : "border-zinc-200 bg-zinc-50 text-zinc-400 cursor-not-allowed"}`}>
                  <MessageSquare className="h-5 w-5" />
                  <span className="text-xs font-semibold">WhatsApp</span>
                  <span className="text-[10px]">{lead.telefono ? "Apri chat" : "—"}</span>
                </a>
                <a href={mailLink || "#"} onClick={e => !mailLink && e.preventDefault()} data-testid="lead-action-email"
                   className={`flex flex-col items-center gap-1 p-3 rounded border ${mailLink ? "border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700" : "border-zinc-200 bg-zinc-50 text-zinc-400 cursor-not-allowed"}`}>
                  <Mail className="h-5 w-5" />
                  <span className="text-xs font-semibold">Email</span>
                  <span className="text-[10px] truncate max-w-full">{lead.email || "Nessuna email"}</span>
                </a>
                <a href={mapLink || "#"} target="_blank" rel="noreferrer" onClick={e => !mapLink && e.preventDefault()} data-testid="lead-action-map"
                   className={`flex flex-col items-center gap-1 p-3 rounded border ${mapLink ? "border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700" : "border-zinc-200 bg-zinc-50 text-zinc-400 cursor-not-allowed"}`}>
                  <MapPin className="h-5 w-5" />
                  <span className="text-xs font-semibold">Mappa</span>
                  <span className="text-[10px] truncate max-w-full">{lead.citta || "Nessun indirizzo"}</span>
                </a>
              </div>
            </div>

            {/* Dati contatto */}
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <div className="text-[11px] uppercase tracking-widest text-zinc-500 font-bold mb-3">Dati contatto</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Nome" v={lead.nome} editing={editing} onChange={v => setForm({ ...form, nome: v })} val={form.nome} testid="lead-fld-nome" />
                <Field label="Cognome" v={lead.cognome} editing={editing} onChange={v => setForm({ ...form, cognome: v })} val={form.cognome} testid="lead-fld-cognome" />
                <Field label="Telefono" v={lead.telefono} editing={editing} onChange={v => setForm({ ...form, telefono: v })} val={form.telefono} testid="lead-fld-telefono" type="tel" />
                <Field label="Email" v={lead.email} editing={editing} onChange={v => setForm({ ...form, email: v })} val={form.email} testid="lead-fld-email" type="email" />
                <Field label="Indirizzo" v={lead.indirizzo} editing={editing} onChange={v => setForm({ ...form, indirizzo: v })} val={form.indirizzo} testid="lead-fld-indirizzo" />
                <Field label="Città" v={lead.citta} editing={editing} onChange={v => setForm({ ...form, citta: v })} val={form.citta} testid="lead-fld-citta" />
              </div>
            </div>

            {/* Dati immobile */}
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <div className="text-[11px] uppercase tracking-widest text-zinc-500 font-bold mb-3">Dati immobile</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Field label="Tipo" v={lead.tipo_immobile} editing={editing} onChange={v => setForm({ ...form, tipo_immobile: v })} val={form.tipo_immobile} testid="lead-fld-tipo" />
                <Field label="MQ" v={lead.mq} editing={editing} onChange={v => setForm({ ...form, mq: parseFloat(v) || 0 })} val={form.mq} testid="lead-fld-mq" type="number" />
                <Field label="Anno" v={lead.anno_costruzione} editing={editing} onChange={v => setForm({ ...form, anno_costruzione: parseInt(v) || null })} val={form.anno_costruzione} testid="lead-fld-anno" type="number" />
                <Field label="Piano" v={lead.piano} editing={editing} onChange={v => setForm({ ...form, piano: v })} val={form.piano} testid="lead-fld-piano" />
                <Field label="Muri" v={lead.tipo_muri} editing={editing} onChange={v => setForm({ ...form, tipo_muri: v })} val={form.tipo_muri} testid="lead-fld-muri" />
                <Field label="Impianti" v={lead.stato_impianti} editing={editing} onChange={v => setForm({ ...form, stato_impianti: v })} val={form.stato_impianti} testid="lead-fld-impianti" />
              </div>
              {lead.note && !editing && (
                <div className="mt-3 pt-3 border-t border-zinc-100">
                  <div className="text-[10px] uppercase text-zinc-500 mb-1">Note iniziali</div>
                  <div className="text-sm whitespace-pre-line">{lead.note}</div>
                </div>
              )}
              {editing && (
                <div className="mt-3 pt-3 border-t border-zinc-100">
                  <Label className="text-xs">Note iniziali</Label>
                  <Textarea value={form.note || ""} onChange={e => setForm({ ...form, note: e.target.value })} rows={3} data-testid="lead-fld-note" />
                </div>
              )}
            </div>

            {/* Esigenze rilevate dal configuratore */}
            {(lead.esigenze || []).length > 0 && (
              <div className="bg-white border border-zinc-200 rounded-lg p-5">
                <div className="text-[11px] uppercase tracking-widest text-zinc-500 font-bold mb-3">Esigenze rilevate (configuratore)</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(lead.esigenze || []).map((e, i) => (
                    <div key={i} className="bg-zinc-50 rounded p-2 text-xs">
                      <div className="font-semibold">{e.key}</div>
                      <div className="text-zinc-600">{Array.isArray(e.val) ? e.val.join(", ") : String(e.val)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lead.pacchetto_consigliato && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase text-amber-700 font-bold">Pacchetto consigliato dal configuratore</div>
                  <div className="text-xl font-bold" style={{ color: "var(--brand)" }}>{String(lead.pacchetto_consigliato).replace("pkg-", "").toUpperCase()}</div>
                </div>
                <Button size="sm" onClick={() => nav("/preventivopacchetto/new", { state: { prefill_lead: lead } })} data-testid="lead-create-preventivo" style={{ background: "var(--brand)", color: "white" }}>
                  <FileText className="h-4 w-4 mr-1" /> Crea Preventivo
                </Button>
              </div>
            )}

          </div>

          {/* COLONNA 3: Stato + Timeline note */}
          <div className="space-y-4">

            {/* Cambio stato */}
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <div className="text-[11px] uppercase tracking-widest text-zinc-500 font-bold mb-3">Stato pipeline</div>
              <div className="space-y-1">
                {STATI.map(s => (
                  <button
                    key={s.k}
                    onClick={() => changeStato(s.k)}
                    data-testid={`lead-set-stato-${s.k}`}
                    className={`w-full text-left px-3 py-2 rounded text-sm border ${lead.stato === s.k ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-200 hover:bg-zinc-50"}`}
                  >
                    {lead.stato === s.k && "✓ "}{s.label}
                  </button>
                ))}
              </div>
              <Button variant="outline" onClick={del} data-testid="lead-delete-btn" className="w-full mt-3 text-rose-600 hover:bg-rose-50 border-rose-200" size="sm"><Trash2 className="h-4 w-4 mr-1" />Elimina lead</Button>
            </div>

            {/* Add note */}
            <div className="bg-white border border-zinc-200 rounded-lg p-5" data-testid="lead-add-note-section">
              <div className="text-[11px] uppercase tracking-widest text-zinc-500 font-bold mb-3">Nuova attività</div>
              <div className="space-y-2">
                <div className="flex gap-1 flex-wrap">
                  {TIPI_NOTA.map(t => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.k}
                        onClick={() => setNota({ ...nota, tipo: t.k })}
                        data-testid={`lead-nota-tipo-${t.k}`}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs border ${nota.tipo === t.k ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-200 hover:bg-zinc-50"}`}
                      >
                        <Icon className="h-3 w-3" /> {t.label}
                      </button>
                    );
                  })}
                </div>
                {(nota.tipo === "chiamata" || nota.tipo === "email" || nota.tipo === "meeting") && (
                  <select className="w-full border border-zinc-300 rounded h-9 px-2 text-sm" value={nota.esito} onChange={e => setNota({ ...nota, esito: e.target.value })} data-testid="lead-nota-esito">
                    <option value="">Esito…</option>
                    <option value="positivo">✅ Positivo / Interessato</option>
                    <option value="neutro">➖ Neutro / Da risentire</option>
                    <option value="negativo">❌ Negativo / Non interessato</option>
                    <option value="no_risposta">📵 Nessuna risposta</option>
                  </select>
                )}
                <Textarea
                  value={nota.testo}
                  onChange={e => setNota({ ...nota, testo: e.target.value })}
                  rows={3}
                  placeholder="Cosa è successo? Es: 'Chiamato alle 15. Disponibile per sopralluogo martedì 12.'"
                  data-testid="lead-nota-testo"
                />
                <Button onClick={addNota} disabled={savingNota || !nota.testo.trim()} data-testid="lead-nota-save" className="w-full" style={{ background: "var(--brand)", color: "white" }}>
                  {savingNota ? "..." : "+ Salva attività"}
                </Button>
              </div>
            </div>

            {/* Timeline note */}
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] uppercase tracking-widest text-zinc-500 font-bold">Cronologia ({noteList.length})</div>
                {noteList.length > 0 && <Calendar className="h-4 w-4 text-zinc-400" />}
              </div>
              {noteList.length === 0 ? (
                <div className="text-xs text-zinc-400 text-center py-6 italic">Nessuna attività registrata. Inizia con una chiamata!</div>
              ) : (
                <div className="space-y-3">
                  {noteList.map(n => {
                    const t = TIPI_NOTA.find(x => x.k === n.tipo) || TIPI_NOTA[0];
                    const Icon = t.icon;
                    const esitoMap = { positivo: "✅", neutro: "➖", negativo: "❌", no_risposta: "📵" };
                    return (
                      <div key={n.id} className="border-l-2 border-zinc-200 pl-3 pb-2" data-testid={`lead-nota-${n.id}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5" style={{ color: `var(--${t.color}-700, #71717a)` }} />
                            <span className="text-xs font-semibold uppercase">{t.label}</span>
                            {n.esito && <span className="text-xs">{esitoMap[n.esito] || ""}</span>}
                          </div>
                          <button onClick={() => delNota(n.id)} className="text-zinc-400 hover:text-rose-600" title="Elimina nota">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="text-sm mt-1 whitespace-pre-line">{n.testo}</div>
                        <div className="text-[10px] text-zinc-500 mt-1">{fmtDate(n.created_at)} · {n.user_nome || "—"}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </Page>
    </div>
  );
}

function Field({ label, v, editing, onChange, val, testid, type = "text" }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</Label>
      {editing ? (
        <Input value={val ?? ""} onChange={e => onChange(e.target.value)} type={type} data-testid={testid} className="h-9" />
      ) : (
        <div className="text-sm font-medium py-1.5" data-testid={testid}>{v || <span className="text-zinc-400 italic font-normal">—</span>}</div>
      )}
    </div>
  );
}
