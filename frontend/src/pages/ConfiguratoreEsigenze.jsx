import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Sparkles, Home, Clock, Bath, ChefHat, Zap, Droplet, Flame, Wind, Square, Layers, Award, DoorClosed, RectangleHorizontal, Hammer, ShieldCheck, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

// PSYCHOLOGY: Avoid asking budget directly. Frame each question to make
// the customer FEEL they need quality. The dealer can use this to upsell.
const DOMANDE = [
  { key: "urgency", q: "Quando vuoi che casa tua sia pronta?", icon: Clock, hint: "Prima è, prima la goderai", opts: [
    { v: "Subito",     label: "Il prima possibile", desc: "Ho già tutto deciso", weight: 2 },
    { v: "1-3 mesi",   label: "Entro 1-3 mesi", desc: "Voglio iniziare quasi subito", weight: 1 },
    { v: "3-6 mesi",   label: "Entro 6 mesi", desc: "Sto pianificando", weight: 0 },
    { v: "Sto valutando", label: "Sto valutando", desc: "Voglio capire cosa serve", weight: 0 },
  ]},
  { key: "muratura", q: "Vuoi modificare le pareti?", icon: Hammer, hint: "Spostare un muro può cambiare la vita di casa", opts: [
    { v: "Si, rivoluziono", label: "Sì, voglio cambiare layout", desc: "Demolizioni & nuovi muri", weight: 3 },
    { v: "Qualche modifica", label: "Qualche modifica", desc: "1-2 muri da spostare/abbattere", weight: 2 },
    { v: "No",            label: "No, va bene così", desc: "Mantengo l'esistente", weight: 0 },
  ]},
  { key: "cucina", q: "La cucina nuova ti renderebbe felice?", icon: ChefHat, hint: "La cucina è il cuore di casa", opts: [
    { v: "Sì, totale",   label: "Sì, completa", desc: "Demolizione + impianti + arredo", weight: 3 },
    { v: "Sì, arredo",   label: "Solo arredo & top", desc: "Tengo gli impianti", weight: 1 },
    { v: "No",           label: "No, è recente", desc: "Va bene così", weight: 0 },
  ]},
  { key: "bagni", q: "Quanti bagni vuoi rinnovare?", icon: Bath, hint: "Bagno nuovo = piacere quotidiano", opts: [
    { v: "0", label: "Nessuno", desc: "Bagno OK", weight: 0 },
    { v: "1", label: "1 bagno", desc: "Quello principale", weight: 1 },
    { v: "2", label: "2 bagni", desc: "Padronale + servizio", weight: 2 },
    { v: "3+", label: "3 o più", desc: "Casa grande", weight: 3 },
  ]},
  // Impianti SEPARATI
  { key: "elettrico", q: "Impianto elettrico: vuoi essere sicuro?", icon: Zap, hint: "Un impianto vecchio è il rischio numero 1 in casa", opts: [
    { v: "Tutto nuovo",         label: "Rifare tutto", desc: "Quadro + linee + prese", weight: 3 },
    { v: "Adeguamento",         label: "Adeguamento normativo", desc: "Solo dove serve", weight: 1 },
    { v: "OK",                  label: "Già a norma", desc: "Recente", weight: 0 },
  ]},
  { key: "idraulico", q: "Impianto idrico-sanitario?", icon: Droplet, hint: "Tubazioni vecchie = perdite future garantite", opts: [
    { v: "Tutto nuovo",      label: "Rifare tutto", desc: "Acqua + scarichi", weight: 3 },
    { v: "Solo bagni",       label: "Solo i bagni", desc: "Punti acqua dei bagni", weight: 1 },
    { v: "OK",               label: "Già rifatto", desc: "Recente", weight: 0 },
  ]},
  { key: "termico", q: "Riscaldamento (caldaia / radiatori)?", icon: Flame, hint: "Una caldaia efficiente abbatte la bolletta", opts: [
    { v: "Pavimento",  label: "Riscaldamento a pavimento", desc: "Massimo comfort", weight: 4 },
    { v: "Radiatori",  label: "Radiatori nuovi", desc: "Sostituzione classica", weight: 2 },
    { v: "Solo caldaia", label: "Solo nuova caldaia", desc: "A condensazione", weight: 1 },
    { v: "OK",          label: "Tutto OK", desc: "Recente", weight: 0 },
  ]},
  { key: "clima", q: "Aria condizionata?", icon: Wind, hint: "Le estati italiane non scherzano più", opts: [
    { v: "Sì installato", label: "Installa tutto", desc: "Split + UE + canalizzazioni", weight: 3 },
    { v: "Predisposizione", label: "Solo predisposizione", desc: "Tubi + scarichi pronti", weight: 1 },
    { v: "No",             label: "No grazie", desc: "", weight: 0 },
  ]},
  { key: "gas", q: "Impianto gas?", icon: Flame, hint: "Sicurezza prima di tutto", opts: [
    { v: "Tutto nuovo", label: "Rifare tutto", desc: "Tubazioni + adeguamento", weight: 2 },
    { v: "OK",           label: "Già OK", desc: "Certificato", weight: 0 },
  ]},
  // INFISSI separati
  { key: "infissi_esterni", q: "Infissi esterni: quanti da cambiare?", icon: RectangleHorizontal, hint: "Buoni infissi = -30% in bolletta", opts: [
    { v: "Tutti",     label: "Tutti", desc: "Cambio completo", weight: 3 },
    { v: "Alcuni",    label: "Alcuni", desc: "I più rovinati", weight: 1 },
    { v: "No",        label: "Nessuno", desc: "OK così", weight: 0 },
  ]},
  { key: "infissi_materiale", q: "Materiale degli infissi esterni preferito?", icon: Layers, hint: "Il materiale fa il design", optional: true, opts: [
    { v: "PVC",        label: "PVC", desc: "Il più economico, ottime prestazioni", weight: 1 },
    { v: "Alluminio",  label: "Alluminio T.T.", desc: "Solido, design moderno", weight: 2 },
    { v: "Legno",      label: "Legno/Alluminio", desc: "Top di gamma, eleganza", weight: 3 },
    { v: "Indeciso",   label: "Decido dopo", desc: "Voglio confrontare", weight: 1 },
  ]},
  { key: "porte_interne", q: "Quante porte interne nuove?", icon: DoorClosed, hint: "Le porte definiscono lo stile della casa", opts: [
    { v: "0", label: "Nessuna", desc: "Le tengo", weight: 0 },
    { v: "1-3", label: "1-3", desc: "Solo le principali", weight: 1 },
    { v: "4-6", label: "4-6", desc: "Quasi tutte", weight: 2 },
    { v: "7+", label: "7 o più", desc: "Tutte nuove", weight: 3 },
  ]},
  { key: "blindata", q: "Porta blindata?", icon: ShieldCheck, hint: "La sicurezza non si compra dopo un furto", opts: [
    { v: "Sì",  label: "Sì, top di gamma", desc: "Classe 4+, biometrica?", weight: 2 },
    { v: "Standard", label: "Sì, standard", desc: "Classe 3", weight: 1 },
    { v: "No, è OK", label: "Tengo l'esistente", desc: "È recente", weight: 0 },
  ]},
  { key: "pavimenti", q: "I pavimenti?", icon: Square, hint: "Il pavimento si vede sempre", opts: [
    { v: "Tutto nuovo",  label: "Rifare tutto", desc: "Demolizione + nuovo", weight: 3 },
    { v: "Solo zone",    label: "Solo alcune zone", desc: "Bagni + cucina", weight: 1 },
    { v: "Sopra",        label: "Posa sopra esistente", desc: "Risparmio demolizioni", weight: 0 },
    { v: "Tengo",        label: "Mantengo", desc: "Mi piacciono", weight: 0 },
  ]},
  { key: "rivestimenti", q: "Rivestimenti bagno/cucina?", icon: Layers, hint: "Le piastrelle definiscono l'eleganza", opts: [
    { v: "Tutto",   label: "Tutto nuovo", desc: "Bagni + cucina", weight: 2 },
    { v: "Solo bagni", label: "Solo bagni", desc: "Cucina già OK", weight: 1 },
    { v: "No",      label: "No", desc: "Già OK", weight: 0 },
  ]},
  { key: "finiture", q: "Che livello di finitura immagini?", icon: Award, hint: "I dettagli fanno la differenza che noterai ogni giorno", opts: [
    { v: "Essenziale", label: "Essenziale", desc: "Pulito, funzionale", weight: 0 },
    { v: "Standard",   label: "Standard buono", desc: "Buona qualità", weight: 1 },
    { v: "Premium",    label: "Premium", desc: "Materiali importanti", weight: 2 },
    { v: "Luxury",     label: "Luxury", desc: "Top assoluto", weight: 3 },
  ]},
];

// Map score → 2 suggested packages (prima scelta + alternativa)
function scorePkg(esigenze) {
  let s = 0;
  DOMANDE.forEach((d) => {
    const v = esigenze[d.key];
    const o = (d.opts || []).find((x) => x.v === v);
    if (o) s += o.weight || 0;
  });
  return s;
}

const PKG_TIERS = [
  { id: "pkg-basic",   name: "BASIC",   color: "#475569", desc: "Refresh essenziale, materiali standard", maxScore: 7 },
  { id: "pkg-smart",   name: "SMART",   color: "#3B82F6", desc: "Ottimo rapporto qualità/prezzo", maxScore: 16 },
  { id: "pkg-premium", name: "PREMIUM", color: "#0EA5E9", desc: "Alta gamma, materiali premium", maxScore: 26 },
  { id: "pkg-elite",   name: "ELITE",   color: "#0A0A0A", desc: "Lusso assoluto, finiture top di gamma", maxScore: 999 },
];

function computePackages(esigenze, dati, packagesDb) {
  const score = scorePkg(esigenze);
  const tier = PKG_TIERS.find((t) => score <= t.maxScore) || PKG_TIERS[3];
  const tierIdx = PKG_TIERS.indexOf(tier);
  const lower = PKG_TIERS[Math.max(0, tierIdx - 1)];
  const findDb = (id) => (packagesDb || []).find((p) => p.id === id || p.name?.toUpperCase() === id.replace("pkg-", "").toUpperCase());
  const tierDb = findDb(tier.id);
  const lowerDb = findDb(lower.id);
  const mq = dati.mq || 80;
  const priceTier = tierDb?.prezzo_mq || (tier.id === "pkg-basic" ? 380 : tier.id === "pkg-smart" ? 580 : tier.id === "pkg-premium" ? 850 : 1300);
  const priceLower = lowerDb?.prezzo_mq || (lower.id === "pkg-basic" ? 380 : lower.id === "pkg-smart" ? 580 : lower.id === "pkg-premium" ? 850 : 1300);
  // Compute extras for the lower tier alternative based on what's "above" base
  const extras = [];
  if (esigenze.blindata === "Sì") extras.push({ name: "Porta blindata top di gamma", price: 1200 });
  if (esigenze.clima === "Sì installato") extras.push({ name: "Climatizzatore dual split", price: 1800 });
  if (esigenze.termico === "Pavimento") extras.push({ name: "Riscaldamento a pavimento (sup.)", price: mq * 60 });
  if (esigenze.rivestimenti === "Tutto") extras.push({ name: "Rivestimenti premium bagno+cucina", price: 2500 });
  if (esigenze.infissi_materiale === "Legno") extras.push({ name: "Upgrade infissi a legno/alluminio", price: 3500 });
  if (esigenze.finiture === "Premium" || esigenze.finiture === "Luxury") extras.push({ name: "Upgrade finiture", price: 2200 });
  const extrasTotal = extras.reduce((s, x) => s + x.price, 0);
  const tierTotal = priceTier * mq;
  const lowerTotal = priceLower * mq + extrasTotal;
  return {
    score,
    primary: { ...tier, db: tierDb, price_mq: priceTier, total: tierTotal },
    alternative: { ...lower, db: lowerDb, price_mq: priceLower, total: lowerTotal, extras, extras_total: extrasTotal },
  };
}

export default function ConfiguratoreEsigenze() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [dati, setDati] = useState({ nome: "", cognome: "", telefono: "", email: "", indirizzo: "", citta: "", cap: "", mq: 0, tipo_immobile: "Appartamento", piano: "", anno_costruzione: "", note: "" });
  const [esigenze, setEsigenze] = useState({});
  const [domandaIdx, setDomandaIdx] = useState(0);
  const [packagesDb, setPackagesDb] = useState([]);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { api.get("/packages").then((r) => setPackagesDb(r.data || [])).catch(() => {}); }, []);

  const result = useMemo(() => computePackages(esigenze, dati, packagesDb), [esigenze, dati, packagesDb]);
  const totalQs = DOMANDE.length;
  const answeredCount = Object.keys(esigenze).filter((k) => esigenze[k]).length;

  useEffect(() => {
    if (step === 2 && !aiText && !aiLoading) {
      setAiLoading(true);
      api.post("/leads/ai-suggest", {
        nome: dati.nome || "Cliente",
        mq: dati.mq,
        esigenze: Object.entries(esigenze).map(([k, v]) => ({ key: k, val: v })),
        pacchetto_consigliato: result.primary.name,
      }).then((r) => setAiText(r.data.text || "")).catch(() => setAiText("")).finally(() => setAiLoading(false));
    }
  }, [step]); // eslint-disable-line

  const saveLead = async (extra = {}) => {
    if (!dati.nome) { toast.error("Nome obbligatorio"); return null; }
    try {
      const { data } = await api.post("/leads", {
        ...dati,
        esigenze: Object.entries(esigenze).map(([k, v]) => ({ key: k, val: v })),
        pacchetto_consigliato: result.primary.id,
        stato: "nuovo",
        ...extra,
      });
      toast.success("Lead salvato!");
      return data;
    } catch { toast.error("Errore salvataggio"); return null; }
  };

  const goPreventivo = async (pkgChoice) => {
    const lead = await saveLead({ pacchetto_scelto: pkgChoice.id });
    nav(`/preventivopacchetto?package=${pkgChoice.id}&mq=${dati.mq}&cliente=${encodeURIComponent(dati.nome + " " + dati.cognome)}${lead ? `&lead_id=${lead.id}` : ""}`);
  };

  const goProgettazione = async (pkgChoice) => {
    const lead = await saveLead({ pacchetto_scelto: pkgChoice.id });
    try {
      const { data } = await api.post("/projects", {
        name: `Progetto ${dati.nome} ${dati.cognome}`.trim(),
        data: { roomHeight: 270, currency: "EUR", packageRef: { package_id: pkgChoice.id, name: pkgChoice.name, mq_inclusi: dati.mq } },
      });
      nav(`/editor/${data.id}`);
    } catch { toast.error("Errore creazione progetto"); }
  };

  const answer = (val) => {
    const d = DOMANDE[domandaIdx];
    setEsigenze({ ...esigenze, [d.key]: val });
    if (domandaIdx < totalQs - 1) setTimeout(() => setDomandaIdx(domandaIdx + 1), 250);
  };

  const dq = DOMANDE[domandaIdx];

  return (
    <div>
      <PageHeader title="Configuratore Esigenze ✨" subtitle={`Trova il pacchetto perfetto in ${totalQs} domande`} />
      <Page>
        <div className="flex items-center gap-2 mb-6 max-w-3xl">
          {[
            { n: 0, label: "Dati Cliente" },
            { n: 1, label: `Esigenze (${answeredCount}/${totalQs})` },
            { n: 2, label: "Risultato" },
          ].map((s, i, arr) => (
            <React.Fragment key={s.n}>
              <button onClick={() => setStep(s.n)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all ${step === s.n ? "bg-zinc-900 text-white" : step > s.n ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-600"}`} data-testid={`ce-step-${s.n}`}>
                <div className="h-5 w-5 rounded-full bg-white/30 flex items-center justify-center text-xs font-bold">{s.n + 1}</div>{s.label}
              </button>
              {i < arr.length - 1 && <div className="flex-1 h-0.5 bg-zinc-200" />}
            </React.Fragment>
          ))}
        </div>

        {step === 0 && (
          <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-5 max-w-4xl">
            <div className="flex items-center gap-3 pb-3 border-b">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center"><Home className="h-5 w-5 text-blue-600" /></div>
              <div><h3 className="text-lg font-semibold">Iniziamo con i tuoi dati</h3><p className="text-sm text-zinc-500">Personalizziamo l'esperienza per te</p></div>
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
              <F label="MQ *"><Input type="number" value={dati.mq || ""} onChange={(e) => setDati({ ...dati, mq: Number(e.target.value) })} placeholder="80" data-testid="ce-mq" /></F>
              <F label="Tipo"><select className="w-full border border-zinc-300 rounded h-10 px-2" value={dati.tipo_immobile} onChange={(e) => setDati({ ...dati, tipo_immobile: e.target.value })}>{["Appartamento","Villa","Attico","Loft","Ufficio"].map((x) => <option key={x}>{x}</option>)}</select></F>
              <F label="Anno costruzione"><Input type="number" value={dati.anno_costruzione || ""} onChange={(e) => setDati({ ...dati, anno_costruzione: Number(e.target.value) })} placeholder="1980" /></F>
              <F label="Piano"><Input value={dati.piano} onChange={(e) => setDati({ ...dati, piano: e.target.value })} placeholder="2°" /></F>
            </div>
            <F label="Note"><Textarea rows={2} value={dati.note} onChange={(e) => setDati({ ...dati, note: e.target.value })} placeholder="Cose particolari da segnalare..." /></F>
            <div className="flex justify-end pt-3"><Button onClick={() => { setStep(1); setDomandaIdx(0); }} disabled={!dati.nome || !dati.mq} style={{ background: "var(--brand)", color: "white" }} data-testid="ce-next-step">Avanti <ChevronRight className="h-4 w-4 ml-1" /></Button></div>
          </div>
        )}

        {step === 1 && dq && (
          <div className="max-w-3xl mx-auto">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-zinc-500">Domanda <strong>{domandaIdx + 1}</strong> di {totalQs}</div>
              <div className="flex gap-1 flex-wrap">
                {DOMANDE.map((_, i) => (
                  <div key={i} className={`h-1.5 w-5 rounded ${esigenze[DOMANDE[i].key] ? "bg-emerald-500" : i === domandaIdx ? "bg-zinc-900" : "bg-zinc-200"}`} />
                ))}
              </div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-soft)" }}><dq.icon className="h-6 w-6" style={{ color: "var(--brand)" }} /></div>
                <h2 className="text-2xl font-bold text-zinc-900">{dq.q}</h2>
              </div>
              {dq.hint && <div className="text-sm text-zinc-500 italic mb-6 ml-15">💡 {dq.hint}</div>}
              <div className={`grid ${dq.opts.length === 4 ? "grid-cols-2 lg:grid-cols-4" : (dq.opts.length === 3 ? "grid-cols-3" : "grid-cols-2")} gap-3`}>
                {dq.opts.map((o) => {
                  const sel = esigenze[dq.key] === o.v;
                  return (
                    <button key={o.v} onClick={() => answer(o.v)} data-testid={`ce-q-${dq.key}-${o.v.replace(/[^a-z0-9]+/gi, "-")}`}
                      className={`p-5 rounded-xl border-2 transition-all hover:-translate-y-1 hover:shadow-md text-left ${sel ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-semibold text-base">{o.label}</div>
                        {sel && <Check className="h-5 w-5 text-emerald-600" />}
                      </div>
                      <div className="text-xs text-zinc-500">{o.desc}</div>
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between items-center mt-8">
                <Button variant="outline" disabled={domandaIdx === 0} onClick={() => setDomandaIdx(domandaIdx - 1)}><ChevronLeft className="h-4 w-4 mr-1" />Indietro</Button>
                <div className="text-xs text-zinc-500">Tip: clicca un'opzione per passare alla prossima ✨</div>
                <Button disabled={!esigenze[dq.key] && !dq.optional} onClick={() => domandaIdx < totalQs - 1 ? setDomandaIdx(domandaIdx + 1) : setStep(2)} style={{ background: "var(--brand)", color: "white" }} data-testid="ce-q-next">
                  {domandaIdx === totalQs - 1 ? "Vedi risultato" : "Avanti"} <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Prima scelta */}
              <PkgCard tier={result.primary} mq={dati.mq} dati={dati} primary
                onPreventivo={() => goPreventivo(result.primary)}
                onProgettazione={() => goProgettazione(result.primary)}
                testid="primary-pkg"
              />
              {/* Alternativa */}
              {result.alternative.id !== result.primary.id && (
                <PkgCard tier={result.alternative} mq={dati.mq} dati={dati}
                  onPreventivo={() => goPreventivo(result.alternative)}
                  onProgettazione={() => goProgettazione(result.alternative)}
                  testid="alternative-pkg"
                />
              )}
            </div>

            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center"><Sparkles className="h-4 w-4 text-white" /></div>
                <span className="font-semibold text-violet-900">Messaggio personalizzato AI</span>
                {aiLoading && <Loader2 className="h-4 w-4 animate-spin text-violet-600" />}
              </div>
              {aiLoading ? <div className="text-violet-700 italic">Sto generando un consiglio personalizzato per te…</div>
                : aiText ? <div className="text-zinc-800 leading-relaxed whitespace-pre-line" data-testid="ai-text">{aiText}</div>
                : <div className="text-zinc-500 italic">AI non disponibile</div>
              }
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              <Button variant="outline" onClick={() => { setStep(1); setDomandaIdx(0); }}>Modifica risposte</Button>
              <Button onClick={() => saveLead()} variant="outline" data-testid="ce-save">💾 Salva Lead nel CRM</Button>
            </div>
          </div>
        )}
      </Page>
    </div>
  );
}

function PkgCard({ tier, mq, dati, primary, onPreventivo, onProgettazione, testid }) {
  const total = tier.total;
  const priceMq = tier.price_mq;
  return (
    <div className={`rounded-2xl overflow-hidden border-2 ${primary ? "border-zinc-900 shadow-2xl" : "border-zinc-200"} bg-white`} data-testid={testid}>
      <div className="p-6 text-white relative" style={{ background: `linear-gradient(135deg, ${tier.color} 0%, var(--brand) 100%)` }}>
        {primary && <div className="absolute top-3 right-3 bg-amber-400 text-zinc-900 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-bold">Consigliato</div>}
        <div className="text-xs uppercase tracking-[0.3em] opacity-80 mb-2">{primary ? "Prima scelta" : "Alternativa più economica"}</div>
        <div className="text-5xl font-extrabold mb-2 tracking-tight">{tier.name}</div>
        <p className="text-sm opacity-90 mb-4">{tier.desc}</p>
        <div className="flex items-end gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest opacity-70">Prezzo al m²</div>
            <div className="text-3xl font-bold">€ {priceMq.toFixed(0)}</div>
          </div>
          <div className="opacity-50 text-xl">×</div>
          <div>
            <div className="text-[10px] uppercase tracking-widest opacity-70">m²</div>
            <div className="text-3xl font-bold">{mq || 80}</div>
          </div>
          <div className="opacity-50 text-xl">=</div>
          <div className="ml-auto">
            <div className="text-[10px] uppercase tracking-widest opacity-70">Totale stimato</div>
            <div className="text-3xl font-bold">€ {Math.round(total).toLocaleString("it-IT")}</div>
          </div>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {tier.extras && tier.extras.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 p-3 rounded">
            <div className="text-xs uppercase tracking-widest text-amber-800 mb-2 font-semibold">Extra inclusi</div>
            <ul className="space-y-1">
              {tier.extras.map((ex, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span>+ {ex.name}</span>
                  <span className="font-mono text-zinc-700">€ {ex.price.toLocaleString("it-IT")}</span>
                </li>
              ))}
              <li className="pt-1 border-t border-amber-300 flex justify-between text-sm font-semibold">
                <span>Totale extra</span>
                <span className="font-mono">€ {tier.extras_total.toLocaleString("it-IT")}</span>
              </li>
            </ul>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onPreventivo} className="h-12 bg-zinc-900 hover:bg-zinc-800 text-white" data-testid={`${testid}-preventivo-btn`}>
            📝 Inizia Preventivo
          </Button>
          <Button onClick={onProgettazione} className="h-12 bg-amber-500 hover:bg-amber-600 text-white" data-testid={`${testid}-progettazione-btn`}>
            ✏️ Progettazione + Preventivo
          </Button>
        </div>
      </div>
    </div>
  );
}

const F = ({ label, children }) => <div><Label className="text-xs text-zinc-600">{label}</Label><div className="mt-1">{children}</div></div>;
