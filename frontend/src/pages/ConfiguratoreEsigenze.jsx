import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Sparkles, Home, Wallet, Clock, Bath, ChefHat, Wrench, Square, Layers, Award, Loader2 } from "lucide-react";
import { toast } from "sonner";

const DOMANDE = [
  { key: "budget", q: "Qual è il tuo budget?", icon: Wallet, opts: [
    { v: "< 30k", emoji: "💰", desc: "Budget contenuto" },
    { v: "30-60k", emoji: "💰💰", desc: "Budget medio" },
    { v: "60-100k", emoji: "💰💰💰", desc: "Budget alto" },
    { v: "> 100k", emoji: "💎", desc: "Senza limiti" },
  ]},
  { key: "urgency", q: "Quando vuoi iniziare?", icon: Clock, opts: [
    { v: "Subito", emoji: "🔥", desc: "Massima urgenza" },
    { v: "1-3 mesi", emoji: "📅", desc: "A breve" },
    { v: "3-6 mesi", emoji: "🗓️", desc: "Medio termine" },
    { v: "Valuto", emoji: "🤔", desc: "In valutazione" },
  ]},
  { key: "bagni", q: "Quanti bagni da rifare?", icon: Bath, opts: [
    { v: "0", emoji: "0️⃣", desc: "Nessuno" },
    { v: "1", emoji: "1️⃣", desc: "Uno" },
    { v: "2", emoji: "2️⃣", desc: "Due" },
    { v: "3+", emoji: "3️⃣", desc: "Tre o più" },
  ]},
  { key: "cucina", q: "La cucina va rifatta?", icon: ChefHat, opts: [
    { v: "Sì, completa", emoji: "🏗️", desc: "Tutto da zero" },
    { v: "Solo piano cottura/arredo", emoji: "🔄", desc: "Solo aggiornamento" },
    { v: "No", emoji: "✅", desc: "È già a posto" },
  ]},
  { key: "impianti", q: "Gli impianti vanno rifatti?", icon: Wrench, opts: [
    { v: "Tutti", emoji: "⚡💧", desc: "Elettrico + idraulico" },
    { v: "Solo elettrico", emoji: "⚡", desc: "Solo elettrico" },
    { v: "Solo idraulico", emoji: "💧", desc: "Solo idraulico" },
    { v: "No", emoji: "✅", desc: "Sono OK" },
  ]},
  { key: "pavimenti", q: "I pavimenti?", icon: Square, opts: [
    { v: "Tutti", emoji: "🔨", desc: "Demolizione completa" },
    { v: "Parziali", emoji: "🧩", desc: "Alcune stanze" },
    { v: "No, solo posa sopra", emoji: "📐", desc: "Sovrapposizione" },
  ]},
  { key: "infissi", q: "Gli infissi vanno cambiati?", icon: Layers, opts: [
    { v: "Tutti", emoji: "🪟🪟", desc: "Tutti nuovi" },
    { v: "Alcuni", emoji: "🪟", desc: "Solo alcuni" },
    { v: "No", emoji: "✅", desc: "Già nuovi" },
  ]},
  { key: "finiture", q: "Livello di finitura desiderato", icon: Award, opts: [
    { v: "Essenziale", emoji: "🪑", desc: "Funzionale" },
    { v: "Standard", emoji: "🎨", desc: "Buona qualità" },
    { v: "Premium", emoji: "✨", desc: "Alta gamma" },
    { v: "Luxury", emoji: "💎", desc: "Lusso assoluto" },
  ]},
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
  if (score >= 10) return { id: "pkg-elite", name: "ELITE", color: "#0A0A0A", desc: "Lusso assoluto, finiture top di gamma" };
  if (score >= 6) return { id: "pkg-premium", name: "PREMIUM", color: "#0EA5E9", desc: "Alta gamma, materiali premium" };
  if (score >= 3) return { id: "pkg-smart", name: "SMART", color: "#3B82F6", desc: "Ottimo rapporto qualità/prezzo" };
  return { id: "pkg-basic", name: "BASIC", color: "#475569", desc: "Refresh essenziale, materiali standard" };
};

export default function ConfiguratoreEsigenze() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [dati, setDati] = useState({ nome: "", cognome: "", telefono: "", email: "", indirizzo: "", citta: "", cap: "", mq: 0, tipo_immobile: "Appartamento", piano: "", anno_costruzione: "", tipo_muri: "Muri portanti", stato_impianti: "Da rifare", ascensore: false, note: "" });
  const [esigenze, setEsigenze] = useState({});
  const [domandaIdx, setDomandaIdx] = useState(0);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const result = consigliaPacchetto(esigenze);
  const totalQs = DOMANDE.length;
  const answeredCount = Object.keys(esigenze).length;

  useEffect(() => {
    if (step === 2 && !aiText && !aiLoading && answeredCount === totalQs) {
      setAiLoading(true);
      api.post("/leads/ai-suggest", {
        nome: dati.nome || "Cliente",
        mq: dati.mq,
        esigenze: Object.entries(esigenze).map(([k, v]) => ({ key: k, val: v })),
        pacchetto_consigliato: result.name,
      }).then((r) => setAiText(r.data.text || "")).catch(() => setAiText("")).finally(() => setAiLoading(false));
    }
  }, [step]); // eslint-disable-line

  const saveLead = async () => {
    if (!dati.nome) return toast.error("Nome obbligatorio");
    try {
      await api.post("/leads", { ...dati, esigenze: Object.entries(esigenze).map(([k, v]) => ({ key: k, val: v })), pacchetto_consigliato: result.id, stato: "nuovo" });
      toast.success("Lead salvato!");
      nav("/crm");
    } catch { toast.error("Errore salvataggio"); }
  };

  const answer = (val) => {
    const d = DOMANDE[domandaIdx];
    setEsigenze({ ...esigenze, [d.key]: val });
    if (domandaIdx < totalQs - 1) setTimeout(() => setDomandaIdx(domandaIdx + 1), 300);
  };

  const dq = DOMANDE[domandaIdx];

  return (
    <div>
      <PageHeader title="Configuratore Esigenze ✨" subtitle="Trova il pacchetto perfetto in 8 domande" />
      <Page>
        {/* Stepper */}
        <div className="flex items-center gap-2 mb-6 max-w-3xl">
          {[
            { n: 0, label: "Dati Cliente" },
            { n: 1, label: `Esigenze (${answeredCount}/${totalQs})` },
            { n: 2, label: "Risultato AI" },
          ].map((s, i, arr) => (
            <React.Fragment key={s.n}>
              <button onClick={() => setStep(s.n)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all ${step === s.n ? "bg-zinc-900 text-white" : step > s.n ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-600"}`} data-testid={`ce-step-${s.n}`}>
                <div className="h-5 w-5 rounded-full bg-white/30 flex items-center justify-center text-xs font-bold">{s.n + 1}</div>
                {s.label}
              </button>
              {i < arr.length - 1 && <div className="flex-1 h-0.5 bg-zinc-200" />}
            </React.Fragment>
          ))}
        </div>

        {step === 0 && (
          <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-5 max-w-4xl">
            <div className="flex items-center gap-3 pb-3 border-b">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center"><Home className="h-5 w-5 text-blue-600" /></div>
              <div><h3 className="text-lg font-semibold">Iniziamo con i tuoi dati</h3><p className="text-sm text-zinc-500">Ci serve qualche info per personalizzare la tua esperienza</p></div>
            </div>
            <h4 className="font-medium">Dati Anagrafici</h4>
            <div className="grid grid-cols-2 gap-3">
              <F label="Nome *"><Input value={dati.nome} onChange={(e) => setDati({ ...dati, nome: e.target.value })} data-testid="ce-nome" placeholder="Mario" /></F>
              <F label="Cognome"><Input value={dati.cognome} onChange={(e) => setDati({ ...dati, cognome: e.target.value })} placeholder="Rossi" /></F>
              <F label="Telefono"><Input value={dati.telefono} onChange={(e) => setDati({ ...dati, telefono: e.target.value })} placeholder="+39..." /></F>
              <F label="Email"><Input value={dati.email} onChange={(e) => setDati({ ...dati, email: e.target.value })} placeholder="mario@..." /></F>
            </div>
            <h4 className="font-medium pt-2">Dati Immobile</h4>
            <div className="grid grid-cols-3 gap-3">
              <F label="Indirizzo"><Input value={dati.indirizzo} onChange={(e) => setDati({ ...dati, indirizzo: e.target.value })} /></F>
              <F label="Città"><Input value={dati.citta} onChange={(e) => setDati({ ...dati, citta: e.target.value })} /></F>
              <F label="MQ *"><Input type="number" value={dati.mq || ""} onChange={(e) => setDati({ ...dati, mq: Number(e.target.value) })} placeholder="80" /></F>
              <F label="Tipo"><select className="w-full border border-zinc-300 rounded h-10 px-2" value={dati.tipo_immobile} onChange={(e) => setDati({ ...dati, tipo_immobile: e.target.value })}>{["Appartamento","Villa","Attico","Loft","Ufficio"].map((x) => <option key={x}>{x}</option>)}</select></F>
              <F label="Anno costruzione"><Input type="number" value={dati.anno_costruzione || ""} onChange={(e) => setDati({ ...dati, anno_costruzione: Number(e.target.value) })} placeholder="1980" /></F>
              <F label="Piano"><Input value={dati.piano} onChange={(e) => setDati({ ...dati, piano: e.target.value })} placeholder="2°" /></F>
            </div>
            <F label="Note"><Textarea rows={2} value={dati.note} onChange={(e) => setDati({ ...dati, note: e.target.value })} placeholder="Cose particolari da segnalare..." /></F>
            <div className="flex justify-end pt-3"><Button onClick={() => { setStep(1); setDomandaIdx(0); }} disabled={!dati.nome || !dati.mq} style={{ background: "var(--brand)", color: "white" }}>Avanti <ChevronRight className="h-4 w-4 ml-1" /></Button></div>
          </div>
        )}

        {step === 1 && dq && (
          <div className="max-w-3xl mx-auto">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-zinc-500">Domanda <strong>{domandaIdx + 1}</strong> di {totalQs}</div>
              <div className="flex gap-1">
                {DOMANDE.map((_, i) => (
                  <div key={i} className={`h-1.5 w-8 rounded ${esigenze[DOMANDE[i].key] ? "bg-emerald-500" : i === domandaIdx ? "bg-zinc-900" : "bg-zinc-200"}`} />
                ))}
              </div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-soft)" }}><dq.icon className="h-6 w-6" style={{ color: "var(--brand)" }} /></div>
                <h2 className="text-2xl font-bold text-zinc-900">{dq.q}</h2>
              </div>
              <div className={`grid ${dq.opts.length === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3"} gap-3`}>
                {dq.opts.map((o) => {
                  const sel = esigenze[dq.key] === o.v;
                  return (
                    <button key={o.v} onClick={() => answer(o.v)} data-testid={`ce-q-${dq.key}-${o.v}`}
                      className={`p-5 rounded-xl border-2 transition-all hover:-translate-y-1 hover:shadow-md text-center ${sel ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`}>
                      <div className="text-4xl mb-2">{o.emoji}</div>
                      <div className="font-semibold text-sm">{o.v}</div>
                      <div className="text-xs text-zinc-500 mt-1">{o.desc}</div>
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between items-center mt-8">
                <Button variant="outline" disabled={domandaIdx === 0} onClick={() => setDomandaIdx(domandaIdx - 1)}><ChevronLeft className="h-4 w-4 mr-1" />Indietro</Button>
                <div className="text-xs text-zinc-500">Tip: clicca un'opzione per passare alla prossima ✨</div>
                <Button disabled={!esigenze[dq.key] || domandaIdx === totalQs - 1 ? answeredCount < totalQs : false} onClick={() => domandaIdx < totalQs - 1 ? setDomandaIdx(domandaIdx + 1) : setStep(2)} style={{ background: "var(--brand)", color: "white" }}>
                  {domandaIdx === totalQs - 1 ? "Vedi risultato" : "Avanti"} <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-3xl mx-auto">
            {/* Big result card with gradient */}
            <div className="rounded-2xl p-10 text-white text-center relative overflow-hidden mb-5" style={{ background: `linear-gradient(135deg, ${result.color} 0%, var(--brand) 100%)` }}>
              <div className="absolute top-4 right-4 opacity-20"><Sparkles className="h-32 w-32" /></div>
              <div className="text-sm uppercase tracking-[0.3em] opacity-80 mb-3">Pacchetto consigliato</div>
              <div className="text-7xl font-extrabold mb-2 tracking-tight" data-testid="ce-result">{result.name}</div>
              <p className="text-lg opacity-90 mb-6">{result.desc}</p>
              <div className="flex justify-center gap-6 text-sm">
                <div><div className="opacity-70">Cliente</div><div className="font-semibold text-base">{dati.nome} {dati.cognome}</div></div>
                <div><div className="opacity-70">Superficie</div><div className="font-semibold text-base">{dati.mq} mq</div></div>
                <div><div className="opacity-70">Risposte</div><div className="font-semibold text-base">{answeredCount}/{totalQs}</div></div>
              </div>
            </div>

            {/* AI Personalized message */}
            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-6 mb-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center"><Sparkles className="h-4 w-4 text-white" /></div>
                <span className="font-semibold text-violet-900">Messaggio personalizzato AI</span>
                {aiLoading && <Loader2 className="h-4 w-4 animate-spin text-violet-600" />}
              </div>
              {aiLoading ? (
                <div className="text-violet-700 italic">Sto generando un consiglio personalizzato per te...</div>
              ) : aiText ? (
                <div className="text-zinc-800 leading-relaxed whitespace-pre-line" data-testid="ai-text">{aiText}</div>
              ) : (
                <div className="text-zinc-500 italic">AI non disponibile</div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              <Button variant="outline" onClick={() => { setStep(1); setDomandaIdx(0); }}>Modifica risposte</Button>
              <Button onClick={saveLead} data-testid="ce-save" style={{ background: "var(--brand)", color: "white" }}>💾 Salva Lead nel CRM</Button>
              <Button onClick={() => nav(`/preventivopacchetto`)} variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white">📝 Crea Preventivo {result.name}</Button>
            </div>
          </div>
        )}
      </Page>
    </div>
  );
}
const F = ({ label, children }) => <div><Label className="text-xs text-zinc-600">{label}</Label><div className="mt-1">{children}</div></div>;
