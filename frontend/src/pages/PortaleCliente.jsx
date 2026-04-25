import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { Briefcase, FileText, Check, MessageSquare, Calendar, Clock, Edit3 } from "lucide-react";
import { toast } from "sonner";

const Page = ({ children }) => <div className="p-6 max-w-5xl mx-auto space-y-6">{children}</div>;

export default function PortaleCliente() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commenti, setCommenti] = useState([]);
  const [newCom, setNewCom] = useState("");
  const [signDoc, setSignDoc] = useState(null);

  const reload = async () => {
    try {
      const r = await api.get("/cliente-portal/me");
      setData(r.data);
      if (r.data?.commessa?.id) {
        const c = await api.get(`/commesse/${r.data.commessa.id}/commenti`);
        setCommenti(c.data || []);
      }
    } catch (e) {} finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const sendCommento = async () => {
    if (!newCom.trim() || !data?.commessa?.id) return;
    try {
      await api.post(`/cliente-portal/commessa/${data.commessa.id}/commenti`, { testo: newCom });
      toast.success("Commento inviato");
      setNewCom("");
      reload();
    } catch (e) { toast.error("Errore"); }
  };

  if (loading) return <Page><div className="mono text-zinc-400">caricamento…</div></Page>;
  if (!data?.commessa) return <Page><div className="text-zinc-500">Nessuna commessa associata al tuo account. Contatta il venditore.</div></Page>;

  const c = data.commessa;
  const expiresAt = data.user?.expires_at;
  const expiresDays = expiresAt ? Math.max(0, Math.round((new Date(expiresAt) - new Date()) / 86400000)) : null;

  return (
    <Page>
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest opacity-80">Commessa</div>
            <h1 className="text-3xl font-semibold tracking-tight mt-1">{c.numero || c.id?.slice(0, 8)}</h1>
            <div className="text-sm opacity-90 mt-1">{c.cliente?.nome} {c.cliente?.cognome}</div>
            <div className="text-sm opacity-90">{c.indirizzo || ""}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest opacity-80">Stato</div>
            <div className="text-xl font-semibold mt-1">{c.stato?.toUpperCase()}</div>
            <div className="text-sm mt-1 opacity-90">Avanzamento: {c.avanzamento_pct || 0}%</div>
            {expiresDays !== null && (
              <div className="mt-2 text-[10px] mono opacity-80">Accesso valido ancora {expiresDays} giorni</div>
            )}
          </div>
        </div>
      </div>

      {/* SAL pubblico (avanzamenti convalidati) */}
      <div className="bg-white border border-zinc-200 rounded p-5">
        <div className="flex items-center gap-2 mb-3">
          <Briefcase className="h-5 w-5 text-zinc-700" />
          <h2 className="text-lg font-semibold">Stato Avanzamento Lavori</h2>
        </div>
        {data.avanzamenti_pubblici?.length === 0 ? (
          <div className="text-sm text-zinc-500">Nessun avanzamento pubblicato per ora.</div>
        ) : (
          <div className="space-y-2" data-testid="sal-list">
            {data.avanzamenti_pubblici.map(av => (
              <div key={av.id} className="border-l-4 border-emerald-500 bg-emerald-50 p-3" data-testid={`sal-${av.id}`}>
                <div className="flex items-center justify-between">
                  <div className="font-medium">{av.descrizione}</div>
                  <div className="text-xs mono text-emerald-700">{av.percentuale}%</div>
                </div>
                <div className="text-xs text-zinc-500 mt-0.5 mono"><Clock size={10} className="inline mr-1" />{av.convalidato_il?.slice(0, 16).replace("T", " ")} · {av.descrizione_lavori}</div>
                {av.note && <div className="text-xs text-zinc-700 mt-1">{av.note}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documenti firmabili / scaricabili */}
      <div className="bg-white border border-zinc-200 rounded p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-5 w-5 text-zinc-700" />
          <h2 className="text-lg font-semibold">Documenti</h2>
        </div>
        {data.documenti?.length === 0 ? (
          <div className="text-sm text-zinc-500">Nessun documento ancora caricato.</div>
        ) : (
          <div className="space-y-2" data-testid="docs-list">
            {data.documenti.map(d => {
              const myFirma = (d.firmato_da || []).find(f => f.user_id === user?.id);
              return (
                <div key={d.id} className="flex items-center justify-between border border-zinc-200 p-3 rounded" data-testid={`doc-${d.id}`}>
                  <div className="flex-1">
                    <div className="font-medium">{d.nome}</div>
                    <div className="text-xs text-zinc-500 mt-0.5 mono">{d.tipo} · {d.stato}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.file_url && <a href={d.file_url} target="_blank" rel="noreferrer" className="text-blue-600 text-xs hover:underline">Scarica</a>}
                    {d.firma_richiesta && (myFirma ? (
                      <span className="text-emerald-700 text-xs mono flex items-center gap-1"><Check size={12} /> FIRMATO {myFirma.firmato_il?.slice(0, 10)}</span>
                    ) : (
                      <Button size="sm" className="rounded-sm h-8 bg-zinc-900 text-white" onClick={() => setSignDoc(d)} data-testid={`firma-${d.id}`}>
                        <Edit3 size={12} className="mr-1" /> Firma con OTP
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Commenti */}
      <div className="bg-white border border-zinc-200 rounded p-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-5 w-5 text-zinc-700" />
          <h2 className="text-lg font-semibold">Commenti</h2>
        </div>
        <div className="space-y-2 mb-3" data-testid="commenti-list">
          {commenti.length === 0 ? <div className="text-sm text-zinc-500">Ancora nessun commento.</div>
            : commenti.map(co => (
              <div key={co.id} className="border-l-2 border-zinc-300 pl-3 py-1">
                <div className="text-xs text-zinc-500 mono">{co.autore_nome} · {co.created_at?.slice(0, 16).replace("T", " ")}</div>
                <div className="text-sm">{co.testo}</div>
              </div>
            ))}
        </div>
        <div className="flex gap-2">
          <Textarea placeholder="Scrivi un commento o domanda al tuo venditore…" rows={2} value={newCom} onChange={e => setNewCom(e.target.value)} className="rounded-sm" data-testid="new-com-input" />
          <Button onClick={sendCommento} className="rounded-sm self-end bg-zinc-900 text-white" data-testid="send-com">Invia</Button>
        </div>
      </div>

      {/* Modal firma OTP */}
      {signDoc && <FirmaOTPModal doc={signDoc} onClose={() => { setSignDoc(null); reload(); }} />}
    </Page>
  );
}

function FirmaOTPModal({ doc, onClose }) {
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState("");
  const [accept, setAccept] = useState(false);
  const [devCode, setDevCode] = useState(null);
  const [loading, setLoading] = useState(false);

  const richiediOTP = async () => {
    setLoading(true);
    try {
      const r = await api.post("/firma/richiedi-otp", { documento_id: doc.id });
      setDevCode(r.data?.dev_otp_code || null);
      toast.success("OTP inviato all'email registrata");
      setStep(2);
    } catch (e) { toast.error(e?.response?.data?.detail || "Errore"); }
    finally { setLoading(false); }
  };
  const conferma = async () => {
    if (!otp || otp.length < 6) { toast.error("Codice OTP non valido"); return; }
    if (!accept) { toast.error("Devi accettare le clausole"); return; }
    setLoading(true);
    try {
      await api.post("/firma/conferma", { documento_id: doc.id, otp_code: otp, accettazione_clausole: true });
      toast.success("Documento firmato. Audit-log salvato.");
      onClose();
    } catch (e) { toast.error(e?.response?.data?.detail || "Errore firma"); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Firma OTP · {doc.nome}</DialogTitle></DialogHeader>
        {step === 1 ? (
          <div className="space-y-3 text-sm">
            <p>Per firmare elettronicamente questo documento riceverai un <b>codice monouso (OTP) via email</b> al tuo indirizzo registrato.</p>
            <p>La firma è apposta ai sensi dell'<b>art. 20 del CAD</b> (Codice Amministrazione Digitale) e del Reg. eIDAS come <b>Firma Elettronica Semplice</b>: ha valore probatorio nelle scritture private tra le parti del contratto.</p>
            <Button onClick={richiediOTP} disabled={loading} className="w-full bg-zinc-900 text-white rounded-sm" data-testid="send-otp-btn">
              {loading ? "Invio…" : "Inviami il codice OTP"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p>Inserisci il codice di 6 cifre ricevuto via email.</p>
            {devCode && <div className="bg-amber-50 border border-amber-300 p-2 rounded text-xs mono">DEV: codice = <b>{devCode}</b></div>}
            <div>
              <Label className="text-xs uppercase tracking-widest">Codice OTP</Label>
              <Input maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))} className="rounded-sm h-10 mt-1.5 mono text-center text-xl tracking-[0.4em]" data-testid="otp-input" />
            </div>
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)} data-testid="accept-checkbox" />
              <span>Dichiaro di aver letto il documento e di accettarne i contenuti. Confermo che l'OTP è stato ricevuto al mio indirizzo email.</span>
            </label>
            <Button onClick={conferma} disabled={loading || !accept} className="w-full bg-emerald-600 text-white rounded-sm" data-testid="confirm-firma-btn">
              {loading ? "Firma in corso…" : "Firma il documento"}
            </Button>
          </div>
        )}
        <DialogFooter><Button variant="ghost" onClick={onClose} className="rounded-sm" data-testid="firma-close">Annulla</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
