import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";

const DOMANDE = [
  { key: "budget", q: "Qual è il budget indicativo?", opts: ["< 30k", "30-60k", "60-100k", "> 100k"] },
  { key: "urgency", q: "Quando vuoi iniziare?", opts: ["Subito", "1-3 mesi", "3-6 mesi", "Valuto"] },
  { key: "bagni", q: "Quanti bagni da rifare?", opts: ["0", "1", "2", "3+"] },
  { key: "cucina", q: "La cucina va rifatta?", opts: ["Sì, completa", "Solo piano cottura/arredo", "No"] },
  { key: "impianti", q: "Gli impianti elettrico/idraulico vanno rifatti?", opts: ["Tutti", "Solo elettrico", "Solo idraulico", "No"] },
  { key: "pavimenti", q: "I pavimenti vanno rifatti?", opts: ["Tutti", "Parziali", "No, solo posa sopra"] },
  { key: "infissi", q: "Gli infissi vanno sostituiti?", opts: ["Tutti", "Alcuni", "No"] },
  { key: "finiture", q: "Livello di finitura desiderato", opts: ["Essenziale", "Standard", "Premium", "Luxury"] },
];

const consigliaPacchetto = (e) => {
  let score = 0;
  if (e.budget === "> 100k") score += 3; else if (e.budget === "60-100k") score += 2; else if (e.budget === "30-60k") score += 1;
  if (e.bagni === "2" || e.bagni === "3+") score += 2;
  if (e.cucina === "Sì, completa") score += 1;
  if (e.impianti === "Tutti") score += 2;
  if (e.pavimenti === "Tutti") score += 1;
  if (e.infissi === "Tutti") score += 1;
  if (e.finiture === "Luxury") score += 3; else if (e.finiture === "Premium") score += 2; else if (e.finiture === "Standard") score += 1;
  if (score >= 10) return { id: "pkg-elite", name: "ELITE" };
  if (score >= 6) return { id: "pkg-premium", name: "PREMIUM" };
  if (score >= 3) return { id: "pkg-smart", name: "SMART" };
  return { id: "pkg-basic", name: "BASIC" };
};

export default function ConfiguratoreEsigenze() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [dati, setDati] = useState({ nome: "", cognome: "", telefono: "", email: "", indirizzo: "", citta: "", cap: "", mq: 0, tipo_immobile: "Appartamento", piano: "", anno_costruzione: "", tipo_muri: "Muri portanti", stato_impianti: "Da rifare", ascensore: false, note: "" });
  const [esigenze, setEsigenze] = useState({});

  const result = consigliaPacchetto(esigenze);
  const allDone = DOMANDE.every((d) => esigenze[d.key]);

  const saveLead = async () => {
    if (!dati.nome) return toast.error("Nome obbligatorio");
    try {
      await api.post("/leads", { ...dati, esigenze: Object.entries(esigenze).map(([k, v]) => ({ key: k, val: v })), pacchetto_consigliato: result.id, stato: "nuovo" });
      toast.success("Lead salvato!");
      nav("/crm");
    } catch { toast.error("Errore salvataggio"); }
  };

  return (
    <div>
      <PageHeader title="Configuratore Esigenze" subtitle="Guida il cliente verso il pacchetto ideale" />
      <Page>
        <div className="flex gap-2 mb-5">
          {["Dati Cliente", `Esigenze (${Object.keys(esigenze).length}/${DOMANDE.length})`, "Risultato"].map((t, i) => (
            <button key={i} onClick={() => setStep(i)} className={`px-3 py-1.5 rounded text-sm ${step === i ? "bg-zinc-900 text-white" : "bg-zinc-100"}`} data-testid={`ce-step-${i}`}>{t}</button>
          ))}
        </div>

        {step === 0 && (
          <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-5 max-w-4xl">
            <h3 className="text-lg font-semibold">Dati Anagrafici</h3>
            <div className="grid grid-cols-2 gap-3">
              <F label="Nome *"><Input value={dati.nome} onChange={(e) => setDati({ ...dati, nome: e.target.value })} data-testid="ce-nome" /></F>
              <F label="Cognome *"><Input value={dati.cognome} onChange={(e) => setDati({ ...dati, cognome: e.target.value })} /></F>
              <F label="Telefono *"><Input value={dati.telefono} onChange={(e) => setDati({ ...dati, telefono: e.target.value })} /></F>
              <F label="Email"><Input value={dati.email} onChange={(e) => setDati({ ...dati, email: e.target.value })} /></F>
            </div>
            <h3 className="text-lg font-semibold">Dati Immobile</h3>
            <div className="grid grid-cols-3 gap-3">
              <F label="Indirizzo *"><Input value={dati.indirizzo} onChange={(e) => setDati({ ...dati, indirizzo: e.target.value })} /></F>
              <F label="Città"><Input value={dati.citta} onChange={(e) => setDati({ ...dati, citta: e.target.value })} /></F>
              <F label="CAP"><Input value={dati.cap} onChange={(e) => setDati({ ...dati, cap: e.target.value })} /></F>
              <F label="Metri Quadri *"><Input type="number" value={dati.mq} onChange={(e) => setDati({ ...dati, mq: Number(e.target.value) })} /></F>
              <F label="Tipo Immobile"><select className="w-full border border-zinc-300 rounded h-10 px-2" value={dati.tipo_immobile} onChange={(e) => setDati({ ...dati, tipo_immobile: e.target.value })}>
                {["Appartamento","Villa","Attico","Loft","Ufficio"].map((x) => <option key={x}>{x}</option>)}</select></F>
              <F label="Anno Costruzione"><Input type="number" value={dati.anno_costruzione} onChange={(e) => setDati({ ...dati, anno_costruzione: Number(e.target.value) })} /></F>
              <F label="Piano"><Input value={dati.piano} onChange={(e) => setDati({ ...dati, piano: e.target.value })} /></F>
              <F label="Tipo Muri"><select className="w-full border border-zinc-300 rounded h-10 px-2" value={dati.tipo_muri} onChange={(e) => setDati({ ...dati, tipo_muri: e.target.value })}>{["Muri portanti","Tramezzi","Misti"].map((x) => <option key={x}>{x}</option>)}</select></F>
              <F label="Stato Impianti"><select className="w-full border border-zinc-300 rounded h-10 px-2" value={dati.stato_impianti} onChange={(e) => setDati({ ...dati, stato_impianti: e.target.value })}>{["Da rifare","Da sistemare","Ok"].map((x) => <option key={x}>{x}</option>)}</select></F>
            </div>
            <F label="Note aggiuntive"><Textarea rows={3} value={dati.note} onChange={(e) => setDati({ ...dati, note: e.target.value })} /></F>
            <div className="flex justify-end"><Button onClick={() => setStep(1)} style={{ background: "var(--brand)", color: "white" }}>Avanti <ChevronRight className="h-4 w-4 ml-1" /></Button></div>
          </div>
        )}

        {step === 1 && (
          <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-5 max-w-4xl">
            {DOMANDE.map((d) => (
              <div key={d.key}>
                <div className="font-medium mb-2">{d.q}</div>
                <div className="flex flex-wrap gap-2">
                  {d.opts.map((o) => (
                    <button key={o} onClick={() => setEsigenze({ ...esigenze, [d.key]: o })} data-testid={`ce-q-${d.key}-${o}`}
                      className={`px-4 py-2 rounded border text-sm transition-all ${esigenze[d.key] === o ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-300 hover:border-zinc-500"}`}>{o}</button>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-3"><Button variant="outline" onClick={() => setStep(0)}><ChevronLeft className="h-4 w-4 mr-1" /> Indietro</Button>
              <Button onClick={() => setStep(2)} disabled={!allDone} style={{ background: "var(--brand)", color: "white" }}>Vedi risultato <ChevronRight className="h-4 w-4 ml-1" /></Button></div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white border border-zinc-200 rounded-lg p-8 max-w-3xl text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-4" style={{ color: "var(--brand)" }} />
            <div className="text-sm text-zinc-500 mb-2">Pacchetto consigliato</div>
            <div className="text-5xl font-bold mb-4" style={{ color: "var(--brand)" }}>{result.name}</div>
            <p className="text-zinc-600 mb-6">Basato sulle risposte di {dati.nome}, questo pacchetto è il più adatto per {dati.mq} mq.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setStep(1)}>Modifica risposte</Button>
              <Button onClick={saveLead} data-testid="ce-save" style={{ background: "var(--brand)", color: "white" }}>Salva Lead</Button>
              <Button onClick={() => nav(`/preventivopacchetto`)} variant="default">Crea Preventivo</Button>
            </div>
          </div>
        )}
      </Page>
    </div>
  );
}
const F = ({ label, children }) => <div><Label className="text-xs text-zinc-600">{label}</Label><div className="mt-1">{children}</div></div>;
