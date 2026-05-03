import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import {
  ArrowRight, ShieldCheck, FileText, BadgeCheck, Sparkles, Hammer, Sofa, Home,
  Lock, Clock, Phone, Mail, MapPin, Send, Star, ChevronDown, Check
} from "lucide-react";

// Brand palette
// Verde brand: #1FAE52 · Verde scuro: #168540 · Nero: #0A0A0A · Off-white: #F5F5F2

const HERO_IMG = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80";

const SERVIZI = [
  {
    icon: Hammer,
    title: "Ristrutturazioni chiavi in mano",
    text: "Dalla pratica edilizia alla consegna delle chiavi. Un solo interlocutore, un solo prezzo, una sola firma.",
    bullets: ["Pratiche e permessi inclusi", "Capitolato dettagliato", "Direzione lavori", "Cantiere certificato"],
    img: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=900&q=80",
    href: "#pacchetti",
    cta: "Vedi pacchetti",
  },
  {
    icon: Sofa,
    title: "Arredamento su misura",
    text: "Progettiamo e realizziamo l'arredo della tua casa. Cucine, bagni, camere, living: tutto coordinato.",
    bullets: ["Progetto d'interni", "Anteprima fotorealistica", "Marchi selezionati", "Posa inclusa"],
    img: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=80",
    href: "#contatti",
    cta: "Richiedi un progetto",
  },
  {
    icon: Home,
    title: "Servizi per la casa a 360°",
    text: "Pulizie post-cantiere, manutenzioni, gestione immobiliare, condomini: una sola squadra di fiducia.",
    bullets: ["Manutenzioni programmate", "Pronto intervento", "Gestione affitti", "Property management"],
    img: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=900&q=80",
    href: "#contatti",
    cta: "Richiedi consulenza",
  },
];

const VALORI = [
  { icon: FileText, title: "Preventivi chiari", text: "Voce per voce, materiale per materiale. Niente formule magiche, niente 'circa'." },
  { icon: Lock, title: "Prezzo bloccato", text: "Quello che firmi è quello che paghi. Eventuali variazioni concordate per iscritto, sempre." },
  { icon: BadgeCheck, title: "Qualità garantita", text: "Artigiani selezionati, marchi certificati, garanzia 5 anni sui lavori realizzati." },
  { icon: ShieldCheck, title: "Processo trasparente", text: "Ogni fase tracciata, documenti firmabili online, accesso sempre attivo al tuo cantiere." },
];

const PACCHETTI = [
  {
    name: "BASIC", tag: "Standard di legge", price: 380, color: "#0A0A0A",
    desc: "Tutto a norma con materiali affidabili. Perfetto per investimento o prima ristrutturazione.",
    feats: ["Demolizioni e smaltimento", "Impianti certificati", "Pavimenti gres 30×60", "Sanitari filo muro", "Tinteggiatura bianca", "Porte interne laminate"],
  },
  {
    name: "SMART", tag: "Il più scelto", price: 490, color: "#1FAE52", highlight: true,
    desc: "Il giusto equilibrio qualità-prezzo. La scelta della maggior parte dei nostri clienti.",
    feats: ["Tutto del Basic", "Pavimenti gres 60×60 effetto", "Porte laminato premium", "Infissi doppio vetro", "Controsoffitti design", "Domotica base predisposta"],
  },
  {
    name: "PREMIUM", tag: "Lusso elegante", price: 790, color: "#0A0A0A",
    desc: "Materiali e finiture di alta gamma per chi cerca eleganza senza compromessi.",
    feats: ["Tutto dello Smart", "Parquet rovere 100% legno", "Sanitari sospesi design", "Infissi triplo vetro", "Domotica base attiva", "Illuminazione progettata"],
  },
  {
    name: "ELITE", tag: "Senza compromessi", price: 1180, color: "#0A0A0A",
    desc: "L'eccellenza assoluta. Materiali di pregio, design d'autore, esecuzione sartoriale.",
    feats: ["Tutto del Premium", "Marmi e pietre naturali", "Domotica avanzata", "Progetto illuminotecnico", "Arredi su misura inclusi", "Concierge dedicato"],
  },
];

const PROCESSO = [
  { n: "01", title: "Sopralluogo gratuito", text: "Un tecnico viene a casa tua, prende le misure e ascolta le tue esigenze. Senza impegno." },
  { n: "02", title: "Progetto + preventivo", text: "Riceverai un progetto su misura con preventivo dettagliato voce per voce. Bloccato per 30 giorni." },
  { n: "03", title: "Cantiere monitorato", text: "Avanzamenti documentati, foto settimanali, accesso al portale cliente per vedere ogni dettaglio." },
  { n: "04", title: "Consegna e garanzia", text: "Ti consegniamo casa pulita e collaudata. Garanzia 5 anni e assistenza post-cantiere inclusa." },
];

const PROGETTI = [
  { src: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=900&q=80", tag: "Living moderno · Milano", area: "85 m²" },
  { src: "https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=900&q=80", tag: "Bagno spa · Bergamo", area: "12 m²" },
  { src: "https://images.unsplash.com/photo-1556909172-54557c7e4fb7?auto=format&fit=crop&w=900&q=80", tag: "Cucina open · Torino", area: "30 m²" },
  { src: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=80", tag: "Camera padronale · Como", area: "22 m²" },
  { src: "https://images.unsplash.com/photo-1600573472556-e636c2acda88?auto=format&fit=crop&w=900&q=80", tag: "Loft industriale · Brescia", area: "110 m²" },
  { src: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80", tag: "Villa lago · Como", area: "260 m²" },
  { src: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=80", tag: "Trilocale chiavi in mano · Milano", area: "75 m²" },
  { src: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=900&q=80", tag: "Bilocale + terrazzo · Monza", area: "55 m²" },
];

const TESTIMONIANZE = [
  { name: "Marco R.", city: "Milano", stars: 5, text: "Preventivo chiarissimo, prezzo rispettato fino all'ultimo euro. Cantiere finito in 7 settimane esatte come promesso." },
  { name: "Laura B.", city: "Bergamo", stars: 5, text: "Mi hanno mostrato il bagno in 3D prima dei lavori. Ho cambiato idea su 2 cose senza costi aggiuntivi. Fantastici." },
  { name: "Famiglia G.", city: "Como", stars: 5, text: "Trasparenza totale: ogni settimana foto del cantiere e documenti firmati online. Mai vista una cosa così seria." },
];

const FAQ = [
  { q: "Il preventivo è davvero bloccato?", a: "Sì. Il prezzo che firmi è quello che paghi. Eventuali variazioni richieste da te (cambio materiali, aggiunte) vengono concordate per iscritto prima dell'esecuzione, mai a sorpresa a fine cantiere." },
  { q: "Posso sfruttare i bonus fiscali?", a: "Certo. Ti aiutiamo a ottenere ristrutturazione 50%, ecobonus, sismabonus e bonus mobili dove applicabili. Forniamo tutta la documentazione fiscale necessaria." },
  { q: "Quanto dura un cantiere medio?", a: "Per un appartamento di 80 m² stimiamo 8-10 settimane lavorative. Per ristrutturazioni importanti (oltre 150 m²) 12-16 settimane. La data di consegna è contrattualmente vincolante." },
  { q: "Cosa succede se trovate problemi imprevisti?", a: "Ti chiamiamo subito, fotografiamo, ti spieghiamo le opzioni con i relativi costi e tempi. Tu decidi. Mai lavori extra non autorizzati." },
  { q: "Avete una garanzia?", a: "5 anni sui lavori edili, oltre alle garanzie di legge dei produttori sui materiali e sugli elettrodomestici. Assistenza post-cantiere inclusa per i primi 12 mesi." },
  { q: "Come posso seguire il cantiere?", a: "Hai accesso al tuo Portale Cliente: SAL aggiornato, foto settimanali, documenti, fatture e firme online via OTP. Sempre attivo, sempre disponibile." },
];

function ServiceCard({ s, i }) {
  const Icon = s.icon;
  return (
    <div className="group relative overflow-hidden bg-white border border-zinc-200 hover:border-[#1FAE52]/40 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl" data-testid={`servizio-card-${i}`}>
      <div className="relative h-56 overflow-hidden">
        <img src={s.img} alt={s.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute top-4 left-4 w-11 h-11 bg-white flex items-center justify-center rounded-full shadow-lg">
          <Icon size={20} className="text-[#1FAE52]" strokeWidth={2.2} />
        </div>
      </div>
      <div className="p-6">
        <h3 className="text-xl font-bold text-[#0A0A0A] mb-2" style={{ fontFamily: "Outfit" }}>{s.title}</h3>
        <p className="text-[14px] text-zinc-600 leading-relaxed mb-4">{s.text}</p>
        <ul className="space-y-1.5 mb-5">
          {s.bullets.map((b) => (
            <li key={b} className="flex items-center gap-2 text-[13px] text-zinc-700">
              <Check size={14} className="text-[#1FAE52] flex-shrink-0" strokeWidth={3} /> {b}
            </li>
          ))}
        </ul>
        <a href={s.href} className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#0A0A0A] group-hover:text-[#1FAE52] transition-colors">
          {s.cta} <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </a>
      </div>
    </div>
  );
}

function PackageCard({ p, i }) {
  const isHi = p.highlight;
  return (
    <div className={`relative flex flex-col ${isHi ? 'bg-[#0A0A0A] text-white border-[#1FAE52]' : 'bg-white text-[#0A0A0A] border-zinc-200'} border-2 p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`} data-testid={`pacchetto-${p.name.toLowerCase()}`}>
      {isHi && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1FAE52] text-white text-[10px] tracking-widest font-bold px-3 py-1 rounded-full">
          IL PIÙ SCELTO
        </div>
      )}
      <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1FAE52] mb-2">{p.tag}</div>
      <div className="text-3xl font-black tracking-tight mb-1" style={{ fontFamily: "Outfit" }}>{p.name}</div>
      <p className={`text-[13px] leading-relaxed mb-5 ${isHi ? 'text-zinc-400' : 'text-zinc-600'}`}>{p.desc}</p>
      <div className="border-t border-b border-zinc-200/30 py-4 mb-5">
        <div className="flex items-baseline gap-1">
          <span className={`text-[11px] uppercase tracking-wider mr-1 ${isHi ? 'text-zinc-500' : 'text-zinc-500'}`}>da</span>
          <span className="text-4xl font-black" style={{ fontFamily: "Outfit" }}>{p.price}</span>
          <span className="text-base font-bold">€</span>
          <span className={`text-[12px] ${isHi ? 'text-zinc-500' : 'text-zinc-500'}`}>/m²</span>
        </div>
        <div className={`text-[11px] mt-1 ${isHi ? 'text-zinc-500' : 'text-zinc-500'}`}>chiavi in mano · IVA 10% inclusa</div>
      </div>
      <ul className="space-y-2 mb-6 flex-1">
        {p.feats.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[13px]">
            <Check size={14} className="mt-0.5 text-[#1FAE52] flex-shrink-0" strokeWidth={3} />
            <span className={isHi ? 'text-zinc-300' : 'text-zinc-700'}>{f}</span>
          </li>
        ))}
      </ul>
      <a
        href="#contatti"
        className={`inline-flex items-center justify-center gap-2 py-3 rounded-full text-[14px] font-bold transition-all ${
          isHi
            ? 'bg-[#1FAE52] text-white hover:bg-[#168540]'
            : 'bg-[#0A0A0A] text-white hover:bg-[#1FAE52]'
        }`}
        data-testid={`pacchetto-cta-${p.name.toLowerCase()}`}
      >
        Richiedi preventivo <ArrowRight size={14} />
      </a>
    </div>
  );
}

function FaqItem({ q, a, i }) {
  const [open, setOpen] = useState(i === 0);
  return (
    <div className="border-b border-zinc-200 py-5" data-testid={`faq-${i}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-6 text-left">
        <span className="text-[16px] font-semibold text-[#0A0A0A]">{q}</span>
        <ChevronDown size={18} className={`text-zinc-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="mt-3 text-[14px] text-zinc-600 leading-relaxed pr-10">{a}</p>}
    </div>
  );
}

export default function Landing() {
  const [contactSent, setContactSent] = useState(false);
  return (
    <div className="bg-white text-[#0A0A0A]" data-testid="landing-page" style={{ fontFamily: "Outfit, system-ui, sans-serif" }}>
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden bg-[#F5F5F2]" data-testid="hero-section">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, #0A0A0A 1px, transparent 0)`, backgroundSize: '24px 24px' }} />
        <div className="relative max-w-7xl mx-auto px-6 py-20 lg:py-28 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 bg-white border border-zinc-200 px-4 py-2 rounded-full mb-7" data-testid="hero-badge">
              <span className="w-2 h-2 rounded-full bg-[#1FAE52] animate-pulse" />
              <span className="text-[12px] font-medium tracking-wide">Studio di ristrutturazioni · dal 2014</span>
            </div>
            <h1 className="text-[44px] sm:text-[56px] lg:text-[72px] leading-[0.95] font-black tracking-tight mb-6" style={{ fontFamily: "Outfit" }}>
              Quando una casa
              <span className="block italic font-light text-[#1FAE52]" style={{ fontFamily: "Georgia, serif" }}>Sa di Casa.</span>
            </h1>
            <p className="text-[17px] lg:text-[19px] text-zinc-700 leading-relaxed mb-9 max-w-xl">
              Ristrutturazioni chiavi in mano, arredamento su misura e servizi per la casa. Tutto sotto un solo tetto, con preventivi chiari e prezzi bloccati.
            </p>
            <div className="flex flex-wrap items-center gap-3 mb-10">
              <a href="#contatti" className="group inline-flex items-center gap-2 bg-[#1FAE52] hover:bg-[#168540] text-white px-7 py-4 rounded-full text-[15px] font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5" data-testid="hero-cta-primary">
                Richiedi preventivo gratuito <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </a>
              <a href="#processo" className="inline-flex items-center gap-2 text-[15px] font-bold text-[#0A0A0A] hover:text-[#1FAE52] transition-colors px-2 py-4" data-testid="hero-cta-secondary">
                Come lavoriamo <ArrowRight size={16} />
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-6 border-t border-zinc-300 text-[13px] text-zinc-700">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#1FAE52]" />
                <span><strong>Garanzia 5 anni</strong> sui lavori</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-[#1FAE52]" />
                <span><strong>Preventivo bloccato</strong>, nessun extra</span>
              </div>
              <div className="flex items-center gap-2">
                <BadgeCheck size={16} className="text-[#1FAE52]" />
                <span>IVA <strong>10%</strong> inclusa</span>
              </div>
            </div>
          </div>
          <div className="lg:col-span-6 relative">
            <div className="relative aspect-[4/5] overflow-hidden rounded-sm">
              <img src={HERO_IMG} alt="Soggiorno luminoso ristrutturato" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            </div>
            {/* Floating card 1 */}
            <div className="absolute -bottom-6 -left-6 lg:-left-10 bg-white shadow-2xl p-5 max-w-[280px] border-l-4 border-[#1FAE52]">
              <div className="text-[11px] font-bold text-[#1FAE52] tracking-widest mb-1">PREVENTIVO BLOCCATO</div>
              <div className="text-[14px] font-semibold text-[#0A0A0A] leading-snug">«Ho pagato esattamente quello che era scritto sul contratto. Niente sorprese.»</div>
              <div className="flex items-center gap-1 mt-2">
                {[1,2,3,4,5].map(n => <Star key={n} size={12} className="fill-[#1FAE52] text-[#1FAE52]" />)}
                <span className="text-[11px] text-zinc-500 ml-1">— Marco, Milano</span>
              </div>
            </div>
            {/* Floating card 2 */}
            <div className="hidden lg:block absolute -top-4 -right-6 bg-[#0A0A0A] text-white shadow-2xl p-4 rounded-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1FAE52] flex items-center justify-center">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <div className="text-[11px] tracking-widest text-zinc-400 font-bold">GARANZIA</div>
                  <div className="text-[15px] font-bold">5 anni sui lavori</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VALORI */}
      <section className="bg-white py-16 lg:py-24 border-b border-zinc-100" data-testid="valori-section">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#1FAE52] mb-3">Quello che ci contraddistingue</div>
            <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-4" style={{ fontFamily: "Outfit" }}>
              Niente sorprese. <span className="italic font-light" style={{ fontFamily: "Georgia, serif" }}>Mai.</span>
            </h2>
            <p className="text-[16px] text-zinc-600 leading-relaxed">
              Crediamo che ristrutturare casa debba essere un'esperienza serena. Per questo abbiamo costruito un metodo basato su quattro principi non negoziabili.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {VALORI.map((v, i) => {
              const Icon = v.icon;
              return (
                <div key={v.title} className="group p-7 bg-[#F5F5F2] border border-transparent hover:border-[#1FAE52] hover:bg-white transition-all duration-300" data-testid={`valore-${i}`}>
                  <div className="w-12 h-12 bg-[#0A0A0A] flex items-center justify-center mb-5 rounded-full group-hover:bg-[#1FAE52] transition-colors">
                    <Icon size={20} className="text-white" strokeWidth={2} />
                  </div>
                  <h3 className="text-lg font-bold mb-2" style={{ fontFamily: "Outfit" }}>{v.title}</h3>
                  <p className="text-[13.5px] text-zinc-600 leading-relaxed">{v.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SERVIZI */}
      <section id="servizi" className="bg-[#F5F5F2] py-16 lg:py-24" data-testid="servizi-section">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-12 gap-6">
            <div className="max-w-2xl">
              <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#1FAE52] mb-3">I nostri servizi</div>
              <h2 className="text-4xl lg:text-5xl font-black tracking-tight" style={{ fontFamily: "Outfit" }}>
                Tutto quello che serve <span className="italic font-light" style={{ fontFamily: "Georgia, serif" }}>alla tua casa.</span>
              </h2>
            </div>
            <p className="text-[15px] text-zinc-600 max-w-md leading-relaxed">
              Un'unica squadra per tutte le esigenze della casa. Niente coordinamento di più aziende, niente palleggiamenti di responsabilità.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVIZI.map((s, i) => <ServiceCard key={s.title} s={s} i={i} />)}
          </div>
        </div>
      </section>

      {/* ARREDAMENTO & DESIGN — sezione dedicata */}
      <section id="arredamento" className="bg-white py-16 lg:py-24" data-testid="arredamento-section">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-10 mb-14">
            <div className="lg:col-span-5">
              <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#1FAE52] mb-3">Arredamento & Design</div>
              <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-5" style={{ fontFamily: "Outfit" }}>
                Disegniamo il tuo spazio
                <span className="block italic font-light" style={{ fontFamily: "Georgia, serif" }}>prima di costruirlo.</span>
              </h2>
              <p className="text-[16px] text-zinc-700 leading-relaxed mb-6">
                Il nostro studio di interior design lavora al tuo fianco dalla prima moodboard al montaggio finale. Tutto coordinato: materiali, luci, mobili, complementi.
              </p>
              <ul className="space-y-3 mb-8">
                {["Progetto d'interni con anteprima 3D fotorealistica", "Marchi italiani selezionati (cucine, bagni, living)", "Squadra di montaggio professionale interna", "Consegna chiavi in mano: tu trovi tutto al suo posto"].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-[14px]">
                    <Check size={16} className="mt-0.5 text-[#1FAE52] flex-shrink-0" strokeWidth={3} />
                    <span className="text-zinc-700">{t}</span>
                  </li>
                ))}
              </ul>
              <a href="#contatti" className="inline-flex items-center gap-2 bg-[#1FAE52] hover:bg-[#168540] text-white px-6 py-3 rounded-full text-[14px] font-bold transition-all">
                Richiedi un progetto d'interni <ArrowRight size={14} />
              </a>
            </div>
            <div className="lg:col-span-7 grid grid-cols-2 gap-3">
              <div className="row-span-2 relative aspect-[3/4] overflow-hidden rounded-sm group">
                <img src="https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?auto=format&fit=crop&w=900&q=80" alt="Cucina moderna" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                  <div className="text-[10px] font-bold tracking-widest text-[#1FAE52]">CUCINE</div>
                  <div className="text-white text-[15px] font-bold">Su misura, italiane</div>
                </div>
              </div>
              <div className="relative aspect-square overflow-hidden rounded-sm group">
                <img src="https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?auto=format&fit=crop&w=600&q=80" alt="Living" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <div className="text-[10px] font-bold tracking-widest text-[#1FAE52]">LIVING</div>
                  <div className="text-white text-[13px] font-bold">Atmosfera calda</div>
                </div>
              </div>
              <div className="relative aspect-square overflow-hidden rounded-sm group">
                <img src="https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=600&q=80" alt="Camera padronale" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <div className="text-[10px] font-bold tracking-widest text-[#1FAE52]">CAMERE</div>
                  <div className="text-white text-[13px] font-bold">Cabina armadio</div>
                </div>
              </div>
            </div>
          </div>

          {/* Categorie arredo */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-14">
            {[
              { name: "Cucine", img: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=400&q=70" },
              { name: "Bagni", img: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=400&q=70" },
              { name: "Soggiorni", img: "https://images.unsplash.com/photo-1567767292278-a4f21aa2d36e?auto=format&fit=crop&w=400&q=70" },
              { name: "Camere", img: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=400&q=70" },
              { name: "Studi & Smart", img: "https://images.unsplash.com/photo-1593476550610-87baa860004a?auto=format&fit=crop&w=400&q=70" },
              { name: "Outdoor", img: "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?auto=format&fit=crop&w=400&q=70" },
            ].map((c) => (
              <div key={c.name} className="relative aspect-square overflow-hidden rounded-sm group cursor-pointer">
                <img src={c.img} alt={c.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="text-white text-[14px] font-bold tracking-wide">{c.name}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Video showcase */}
          <div className="grid lg:grid-cols-3 gap-6 mb-12">
            <div className="lg:col-span-2 relative aspect-video overflow-hidden rounded-sm bg-zinc-900 group">
              <video
                autoPlay muted loop playsInline
                poster="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80"
                className="w-full h-full object-cover"
                data-testid="arredo-video-1"
              >
                <source src="https://cdn.coverr.co/videos/coverr-an-architects-workspace-2596/1080p.mp4" type="video/mp4" />
              </video>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                <div className="text-[10px] font-bold tracking-widest text-[#1FAE52] mb-1">DIETRO LE QUINTE</div>
                <div className="text-white text-2xl font-bold" style={{ fontFamily: "Outfit" }}>Lo studio di progettazione</div>
                <div className="text-zinc-300 text-[13px] mt-1">Dai sopralluogo al rendering 3D, ogni progetto nasce sui nostri tavoli.</div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-[#0A0A0A] text-white p-6 rounded-sm">
                <div className="text-[10px] font-bold tracking-widest text-[#1FAE52] mb-2">PROCESSO</div>
                <div className="text-2xl font-bold mb-3" style={{ fontFamily: "Outfit" }}>Anteprima fotorealistica</div>
                <p className="text-zinc-400 text-[13px] leading-relaxed mb-4">
                  Vedi la tua casa finita prima ancora che i lavori inizino. Cambia idea quante volte vuoi, senza costi extra.
                </p>
                <a href="#contatti" className="text-[#1FAE52] text-[13px] font-bold hover:underline inline-flex items-center gap-1">
                  Richiedi una bozza <ArrowRight size={12} />
                </a>
              </div>
              <div className="bg-[#F5F5F2] p-6 rounded-sm">
                <div className="text-[10px] font-bold tracking-widest text-[#1FAE52] mb-2">QUALITÀ</div>
                <div className="text-2xl font-bold mb-3" style={{ fontFamily: "Outfit" }}>Marchi selezionati</div>
                <p className="text-zinc-700 text-[13px] leading-relaxed">
                  Lavoriamo solo con i migliori produttori italiani. Ti facciamo risparmiare grazie alle nostre convenzioni dirette.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MONTAGGIO & CANTIERE — video sezione */}
      <section className="bg-[#0A0A0A] text-white py-16 lg:py-24 relative overflow-hidden" data-testid="montaggio-section">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`, backgroundSize: '24px 24px' }} />
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5 order-2 lg:order-1">
              <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#1FAE52] mb-3">In cantiere</div>
              <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-5" style={{ fontFamily: "Outfit" }}>
                Mani esperte
                <span className="block italic font-light text-zinc-400" style={{ fontFamily: "Georgia, serif" }}>tempi rispettati.</span>
              </h2>
              <p className="text-[16px] text-zinc-400 leading-relaxed mb-6">
                Squadra interna, niente subappalti improvvisati. Posatori specializzati, capi-cantiere certificati, montatori d'arredamento esperti.
              </p>
              <div className="grid grid-cols-2 gap-5 mb-8">
                <div>
                  <div className="text-3xl font-black text-[#1FAE52]" style={{ fontFamily: "Outfit" }}>8-10</div>
                  <div className="text-[12px] text-zinc-400 mt-1">settimane medie<br/>per appartamento 80 m²</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-[#1FAE52]" style={{ fontFamily: "Outfit" }}>0</div>
                  <div className="text-[12px] text-zinc-400 mt-1">ritardi medi sulla<br/>consegna negli ultimi 12 mesi</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-[#1FAE52]" style={{ fontFamily: "Outfit" }}>5y</div>
                  <div className="text-[12px] text-zinc-400 mt-1">garanzia post-cantiere<br/>su lavori e finiture</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-[#1FAE52]" style={{ fontFamily: "Outfit" }}>100%</div>
                  <div className="text-[12px] text-zinc-400 mt-1">cantieri tracciati<br/>con foto settimanali</div>
                </div>
              </div>
              <a href="#contatti" className="inline-flex items-center gap-2 bg-[#1FAE52] hover:bg-[#168540] text-white px-6 py-3 rounded-full text-[14px] font-bold transition-all">
                Pianifica il tuo cantiere <ArrowRight size={14} />
              </a>
            </div>
            <div className="lg:col-span-7 order-1 lg:order-2 grid grid-cols-2 gap-3">
              <div className="col-span-2 relative aspect-video overflow-hidden rounded-sm bg-zinc-800">
                <video
                  autoPlay muted loop playsInline
                  poster="https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1200&q=80"
                  className="w-full h-full object-cover"
                  data-testid="cantiere-video"
                >
                  <source src="https://cdn.coverr.co/videos/coverr-construction-worker-with-a-trowel-9395/1080p.mp4" type="video/mp4" />
                </video>
                <div className="absolute top-4 left-4 inline-flex items-center gap-2 bg-black/70 backdrop-blur px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-[#1FAE52] animate-pulse" />
                  <span className="text-[11px] font-bold tracking-wider">CANTIERE LIVE</span>
                </div>
              </div>
              <div className="relative aspect-video overflow-hidden rounded-sm bg-zinc-800">
                <img src="https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=600&q=70" alt="Posa pavimento" className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="text-[10px] font-bold tracking-widest text-[#1FAE52]">POSA</div>
                  <div className="text-white text-[12px] font-bold">Pavimenti & rivestimenti</div>
                </div>
              </div>
              <div className="relative aspect-video overflow-hidden rounded-sm bg-zinc-800">
                <img src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=70" alt="Montaggio cucina" className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="text-[10px] font-bold tracking-widest text-[#1FAE52]">MONTAGGIO</div>
                  <div className="text-white text-[12px] font-bold">Cucine & arredi</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PACCHETTI */}
      <section id="pacchetti" className="bg-white py-16 lg:py-24" data-testid="pacchetti-section">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#1FAE52] mb-3">Prezzi chiari, tutto incluso</div>
            <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-4" style={{ fontFamily: "Outfit" }}>
              Quattro pacchetti. <span className="italic font-light" style={{ fontFamily: "Georgia, serif" }}>Zero sorprese.</span>
            </h2>
            <p className="text-[16px] text-zinc-600 leading-relaxed">
              Scegli il livello di finitura che preferisci. Tutti i pacchetti sono <strong>chiavi in mano</strong>: dalle pratiche alla pulizia finale, IVA 10% inclusa.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
            {PACCHETTI.map((p, i) => <PackageCard key={p.name} p={p} i={i} />)}
          </div>
          <div className="text-center text-[13px] text-zinc-500 max-w-2xl mx-auto leading-relaxed">
            * Prezzo indicativo per ristrutturazione completa di abitazione esistente sopra i 60 m². Ti forniremo un preventivo dettagliato e bloccato dopo il sopralluogo gratuito.
          </div>
        </div>
      </section>

      {/* PROCESSO */}
      <section id="processo" className="bg-[#0A0A0A] text-white py-16 lg:py-28 relative overflow-hidden" data-testid="processo-section">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`, backgroundSize: '24px 24px' }} />
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="max-w-2xl mb-14">
            <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#1FAE52] mb-3">Come lavoriamo</div>
            <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-4" style={{ fontFamily: "Outfit" }}>
              Quattro passaggi. <span className="italic font-light text-zinc-400" style={{ fontFamily: "Georgia, serif" }}>Mai uno di più.</span>
            </h2>
            <p className="text-[16px] text-zinc-400 leading-relaxed">
              Un processo collaudato che porta dalla prima telefonata alle chiavi in mano in modo lineare e prevedibile.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-1">
            {PROCESSO.map((step, i) => (
              <div key={step.n} className="relative bg-[#0F0F0F] hover:bg-[#1A1A1A] transition-colors p-7 border border-zinc-900" data-testid={`processo-step-${i}`}>
                <div className="text-[#1FAE52] text-5xl font-black mb-4" style={{ fontFamily: "Outfit" }}>{step.n}</div>
                <h3 className="text-xl font-bold mb-3" style={{ fontFamily: "Outfit" }}>{step.title}</h3>
                <p className="text-[13.5px] text-zinc-400 leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-4 justify-center">
            <a href="#contatti" className="group inline-flex items-center gap-2 bg-[#1FAE52] hover:bg-[#168540] text-white px-7 py-4 rounded-full text-[15px] font-bold transition-all" data-testid="processo-cta">
              Inizia con un sopralluogo gratuito <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </a>
            <a href="tel:+390000000000" className="inline-flex items-center gap-2 text-zinc-300 hover:text-white text-[15px] font-semibold">
              <Phone size={16} /> 800 123 456
            </a>
          </div>
        </div>
      </section>

      {/* PROGETTI */}
      <section id="progetti" className="bg-[#F5F5F2] py-16 lg:py-24" data-testid="progetti-section">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-12 gap-6">
            <div className="max-w-2xl">
              <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#1FAE52] mb-3">I nostri progetti</div>
              <h2 className="text-4xl lg:text-5xl font-black tracking-tight" style={{ fontFamily: "Outfit" }}>
                Le case che <span className="italic font-light" style={{ fontFamily: "Georgia, serif" }}>sanno di noi.</span>
              </h2>
            </div>
            <p className="text-[15px] text-zinc-600 max-w-md leading-relaxed">
              Una selezione dei lavori realizzati negli ultimi anni. Ogni casa è una storia diversa, con un solo standard di qualità.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {PROGETTI.map((p, i) => (
              <div key={i} className="group relative aspect-square overflow-hidden bg-zinc-200" data-testid={`progetto-${i}`}>
                <img src={p.src} alt={p.tag} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                  <div className="text-[10px] font-bold tracking-widest text-[#1FAE52] mb-1">{p.area}</div>
                  <div className="text-[14px] font-semibold text-white leading-tight">{p.tag}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="bg-white py-16 lg:py-24" data-testid="testimonial-section">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#1FAE52] mb-3">Cosa dicono di noi</div>
            <h2 className="text-4xl lg:text-5xl font-black tracking-tight" style={{ fontFamily: "Outfit" }}>
              4,9 stelle su Google. <span className="italic font-light" style={{ fontFamily: "Georgia, serif" }}>Non per caso.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIANZE.map((t, i) => (
              <div key={i} className="bg-[#F5F5F2] p-7 border-t-4 border-[#1FAE52]" data-testid={`testimonial-${i}`}>
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.stars }).map((_, n) => <Star key={n} size={16} className="fill-[#1FAE52] text-[#1FAE52]" />)}
                </div>
                <p className="text-[15px] text-zinc-800 leading-relaxed mb-5 italic">«{t.text}»</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center font-bold text-sm">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-[14px] font-bold">{t.name}</div>
                    <div className="text-[12px] text-zinc-500">{t.city}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-[#F5F5F2] py-16 lg:py-24" data-testid="faq-section">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#1FAE52] mb-3">Domande frequenti</div>
            <h2 className="text-4xl lg:text-5xl font-black tracking-tight" style={{ fontFamily: "Outfit" }}>
              Quello che <span className="italic font-light" style={{ fontFamily: "Georgia, serif" }}>tutti chiedono.</span>
            </h2>
          </div>
          <div>
            {FAQ.map((f, i) => <FaqItem key={f.q} q={f.q} a={f.a} i={i} />)}
          </div>
        </div>
      </section>

      {/* CONTATTI */}
      <section id="contatti" className="bg-white py-16 lg:py-24 border-y border-zinc-100" data-testid="contatti-section">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12">
          <div>
            <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#1FAE52] mb-3">Parliamone</div>
            <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-5" style={{ fontFamily: "Outfit" }}>
              Pronto a ristrutturare?
              <span className="block italic font-light" style={{ fontFamily: "Georgia, serif" }}>Iniziamo da un caffè.</span>
            </h2>
            <p className="text-[16px] text-zinc-600 mb-8 leading-relaxed">
              Compila il form: ti richiamiamo entro 24h per fissare un sopralluogo gratuito senza alcun impegno. Oppure chiamaci direttamente.
            </p>
            <div className="space-y-4">
              <a href="tel:+390000000000" className="flex items-center gap-4 group" data-testid="contact-phone">
                <div className="w-12 h-12 bg-[#0A0A0A] group-hover:bg-[#1FAE52] flex items-center justify-center rounded-full transition-colors">
                  <Phone size={18} className="text-white" />
                </div>
                <div>
                  <div className="text-[12px] text-zinc-500 font-medium">Chiamaci subito</div>
                  <div className="text-[18px] font-bold">800 123 456</div>
                </div>
              </a>
              <a href="mailto:info@sadicasa.it" className="flex items-center gap-4 group" data-testid="contact-email">
                <div className="w-12 h-12 bg-[#0A0A0A] group-hover:bg-[#1FAE52] flex items-center justify-center rounded-full transition-colors">
                  <Mail size={18} className="text-white" />
                </div>
                <div>
                  <div className="text-[12px] text-zinc-500 font-medium">Scrivici</div>
                  <div className="text-[16px] font-semibold">info@sadicasa.it</div>
                </div>
              </a>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#0A0A0A] flex items-center justify-center rounded-full">
                  <MapPin size={18} className="text-white" />
                </div>
                <div>
                  <div className="text-[12px] text-zinc-500 font-medium">Vieni in showroom</div>
                  <div className="text-[16px] font-semibold">Via Roma 123, Milano</div>
                </div>
              </div>
            </div>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); setContactSent(true); }}
            className="bg-[#F5F5F2] p-8 lg:p-10"
            data-testid="contact-form"
          >
            {contactSent ? (
              <div className="text-center py-12" data-testid="contact-success">
                <div className="w-16 h-16 mx-auto bg-[#1FAE52] rounded-full flex items-center justify-center mb-5">
                  <Check size={28} className="text-white" strokeWidth={3} />
                </div>
                <h3 className="text-2xl font-black mb-2" style={{ fontFamily: "Outfit" }}>Richiesta ricevuta</h3>
                <p className="text-[15px] text-zinc-600">Ti ricontattiamo entro 24 ore. Grazie per averci scelto.</p>
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-black mb-2" style={{ fontFamily: "Outfit" }}>Richiedi preventivo gratuito</h3>
                <p className="text-[14px] text-zinc-600 mb-6">Risposta garantita entro 24 ore lavorative.</p>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" required placeholder="Nome" className="w-full px-4 py-3.5 bg-white border border-zinc-200 focus:border-[#1FAE52] focus:outline-none text-[14px] transition-colors" data-testid="contact-nome" />
                    <input type="text" required placeholder="Cognome" className="w-full px-4 py-3.5 bg-white border border-zinc-200 focus:border-[#1FAE52] focus:outline-none text-[14px] transition-colors" data-testid="contact-cognome" />
                  </div>
                  <input type="email" required placeholder="Email" className="w-full px-4 py-3.5 bg-white border border-zinc-200 focus:border-[#1FAE52] focus:outline-none text-[14px] transition-colors" data-testid="contact-email-input" />
                  <input type="tel" required placeholder="Telefono" className="w-full px-4 py-3.5 bg-white border border-zinc-200 focus:border-[#1FAE52] focus:outline-none text-[14px] transition-colors" data-testid="contact-telefono" />
                  <select className="w-full px-4 py-3.5 bg-white border border-zinc-200 focus:border-[#1FAE52] focus:outline-none text-[14px] transition-colors" data-testid="contact-servizio">
                    <option>Cosa ti serve?</option>
                    <option>Ristrutturazione completa</option>
                    <option>Solo bagno / cucina</option>
                    <option>Arredamento</option>
                    <option>Manutenzione / Servizi casa</option>
                    <option>Altro</option>
                  </select>
                  <textarea rows={4} placeholder="Raccontaci il tuo progetto (mq, città, tempi…)" className="w-full px-4 py-3.5 bg-white border border-zinc-200 focus:border-[#1FAE52] focus:outline-none text-[14px] transition-colors resize-none" data-testid="contact-messaggio" />
                  <label className="flex items-start gap-2 text-[12px] text-zinc-600">
                    <input type="checkbox" required className="mt-1 accent-[#1FAE52]" data-testid="contact-privacy" />
                    <span>Ho letto e accetto la <a href="#" className="underline">privacy policy</a> e autorizzo il trattamento dei miei dati per essere ricontattato.</span>
                  </label>
                  <button type="submit" className="w-full inline-flex items-center justify-center gap-2 bg-[#1FAE52] hover:bg-[#168540] text-white py-4 rounded-full text-[15px] font-bold transition-all hover:shadow-lg" data-testid="contact-submit">
                    Invia richiesta <Send size={16} />
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0A0A0A] text-white" data-testid="footer">
        <div className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <img src="/brand/sadicasa-dark.png" alt="Sa di Casa" className="h-14 w-auto mb-4" />
            <p className="text-[13px] text-zinc-400 leading-relaxed mb-5">
              Ristrutturazioni chiavi in mano, arredamento su misura e servizi per la casa. Dal 2014 trasformiamo le case dei nostri clienti con preventivi chiari e prezzi bloccati.
            </p>
            <div className="flex items-center gap-2 text-[12px] text-zinc-500">
              <ShieldCheck size={14} className="text-[#1FAE52]" /> Garanzia 5 anni · IVA 10% inclusa
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-widest text-zinc-500 mb-4">SERVIZI</div>
            <ul className="space-y-2.5 text-[14px]">
              <li><a href="#servizi" className="text-zinc-300 hover:text-[#1FAE52] transition-colors">Ristrutturazioni chiavi in mano</a></li>
              <li><a href="#arredamento" className="text-zinc-300 hover:text-[#1FAE52] transition-colors">Arredamento su misura</a></li>
              <li><a href="#servizi" className="text-zinc-300 hover:text-[#1FAE52] transition-colors">Servizi per la casa 360°</a></li>
              <li><a href="#pacchetti" className="text-zinc-300 hover:text-[#1FAE52] transition-colors">I nostri pacchetti</a></li>
              <li><a href="#progetti" className="text-zinc-300 hover:text-[#1FAE52] transition-colors">Progetti realizzati</a></li>
            </ul>
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-widest text-zinc-500 mb-4">AZIENDA</div>
            <ul className="space-y-2.5 text-[14px]">
              <li><a href="#processo" className="text-zinc-300 hover:text-[#1FAE52] transition-colors">Come lavoriamo</a></li>
              <li><a href="#" className="text-zinc-300 hover:text-[#1FAE52] transition-colors">Chi siamo</a></li>
              <li><a href="#" className="text-zinc-300 hover:text-[#1FAE52] transition-colors">Blog & Guide</a></li>
              <li><a href="#contatti" className="text-zinc-300 hover:text-[#1FAE52] transition-colors">Contatti</a></li>
              <li><Link to="/login" className="text-zinc-300 hover:text-[#1FAE52] transition-colors">Area riservata</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-widest text-zinc-500 mb-4">CONTATTI</div>
            <ul className="space-y-3 text-[14px]">
              <li className="flex items-start gap-3 text-zinc-300">
                <Phone size={14} className="mt-1 text-[#1FAE52]" /> 800 123 456
              </li>
              <li className="flex items-start gap-3 text-zinc-300">
                <Mail size={14} className="mt-1 text-[#1FAE52]" /> info@sadicasa.it
              </li>
              <li className="flex items-start gap-3 text-zinc-300">
                <MapPin size={14} className="mt-1 text-[#1FAE52]" /> Via Roma 123<br />20100 Milano
              </li>
              <li className="flex items-start gap-3 text-zinc-300">
                <Clock size={14} className="mt-1 text-[#1FAE52]" /> Lun–Sab 9.00–19.00
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-zinc-900">
          <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[12px] text-zinc-500">
            <div>© {new Date().getFullYear()} Sa di Casa S.r.l. · P.IVA 01234567890 · Tutti i diritti riservati</div>
            <div className="flex gap-5">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Cookie Policy</a>
              <a href="#" className="hover:text-white transition-colors">Termini di servizio</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
