import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { Button } from "../components/ui/button";
import { ArrowRight, Ruler, Box, Sparkles, FileText, Layers, Calculator } from "lucide-react";

const HERO_BG = "https://images.unsplash.com/photo-1721244654392-9c912a6eb236?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwyfHxhcmNoaXRlY3QlMjBibHVlcHJpbnQlMjBza2V0Y2h8ZW58MHx8fHwxNzc3MDYyMTc4fDA&ixlib=rb-4.1.0&q=85";
const FEATURE_1 = "https://images.unsplash.com/photo-1770838772868-4bd5ec67863c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHw0fHxyZW5vdmF0aW9uJTIwY29uc3RydWN0aW9uJTIwbWF0ZXJpYWxzfGVufDB8fHx8MTc3NzA2MjE4NHww&ixlib=rb-4.1.0&q=85";
const FEATURE_2 = "https://images.unsplash.com/photo-1721132537184-5494c01ed87f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwxfHxhcmNoaXRlY3QlMjBibHVlcHJpbnQlMjBza2V0Y2h8ZW58MHx8fHwxNzc3MDYyMTc4fDA&ixlib=rb-4.1.0&q=85";

export default function Landing() {
  return (
    <div className="bg-white" data-testid="landing-page">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-zinc-200">
        <div className="absolute inset-0 opacity-[0.08]">
          <img src={HERO_BG} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7">
            <div className="label-kicker mb-6">CAD · Preventivo · Rendering AI</div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[0.95] text-zinc-900" style={{ fontFamily: "Outfit" }}>
              Progetta la ristrutturazione.
              <span className="block text-zinc-400">Preventiva al millimetro.</span>
            </h1>
            <p className="mt-8 max-w-xl text-lg text-zinc-600 leading-relaxed">
              Un unico strumento per disegnare in 2D, vedere la stanza in 3D, generare un rendering fotorealistico con l'AI e stampare il preventivo in PDF.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link to="/register" data-testid="hero-cta-register">
                <Button size="lg" className="rounded-sm bg-zinc-900 hover:bg-zinc-800 h-12 px-6">
                  Apri l'editor <ArrowRight size={16} className="ml-2" />
                </Button>
              </Link>
              <Link to="/login" data-testid="hero-cta-login">
                <Button size="lg" variant="outline" className="rounded-sm h-12 px-6">Accedi</Button>
              </Link>
              <div className="mono text-xs text-zinc-500 ml-2">no carta di credito · 14 giorni di progetti illimitati</div>
            </div>

            <div className="mt-14 grid grid-cols-3 max-w-lg gap-8">
              <div>
                <div className="mono text-3xl text-zinc-900">2D+3D</div>
                <div className="text-xs text-zinc-500 mt-1">Pianta e vista immersiva</div>
              </div>
              <div>
                <div className="mono text-3xl text-zinc-900">€/m²</div>
                <div className="text-xs text-zinc-500 mt-1">Preventivo istantaneo</div>
              </div>
              <div>
                <div className="mono text-3xl text-zinc-900">AI</div>
                <div className="text-xs text-zinc-500 mt-1">Render fotorealistico</div>
              </div>
            </div>
          </div>

          {/* Minimal floor plan illustration */}
          <div className="lg:col-span-5 relative">
            <div className="border border-zinc-300 aspect-[4/3] bg-white relative cad-grid-major">
              <svg viewBox="0 0 400 300" className="absolute inset-0 w-full h-full">
                <rect x="40" y="40" width="320" height="220" stroke="#0A0A0A" strokeWidth="3" fill="none" />
                <line x1="200" y1="40" x2="200" y2="180" stroke="#0A0A0A" strokeWidth="3" />
                <line x1="200" y1="180" x2="360" y2="180" stroke="#0A0A0A" strokeWidth="3" />
                {/* door arc */}
                <path d="M 200 40 A 30 30 0 0 1 230 70" stroke="#2563EB" strokeWidth="1.5" fill="none" strokeDasharray="3,3" />
                {/* window */}
                <line x1="60" y1="40" x2="120" y2="40" stroke="#2563EB" strokeWidth="5" />
                {/* labels */}
                <text x="115" y="120" fontSize="11" fill="#71717A" fontFamily="JetBrains Mono">soggiorno</text>
                <text x="115" y="134" fontSize="10" fill="#0A0A0A" fontFamily="JetBrains Mono">28.4 m²</text>
                <text x="265" y="120" fontSize="11" fill="#71717A" fontFamily="JetBrains Mono">camera</text>
                <text x="265" y="134" fontSize="10" fill="#0A0A0A" fontFamily="JetBrains Mono">14.2 m²</text>
                <text x="265" y="225" fontSize="11" fill="#71717A" fontFamily="JetBrains Mono">bagno</text>
                <text x="265" y="239" fontSize="10" fill="#0A0A0A" fontFamily="JetBrains Mono">6.8 m²</text>
              </svg>
              <div className="absolute top-3 left-3 label-kicker">fig.01 / planimetria</div>
              <div className="absolute bottom-3 right-3 mono text-xs text-zinc-500">scala 1:50</div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-7xl mx-auto px-6 py-24 border-b border-zinc-200">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <div className="label-kicker mb-4">Cosa puoi fare</div>
            <h2 className="text-4xl font-semibold tracking-tight text-zinc-900" style={{ fontFamily: "Outfit" }}>
              Dal disegno al preventivo, senza cambiare strumento.
            </h2>
          </div>
          <div className="lg:col-span-8 grid sm:grid-cols-2 gap-px bg-zinc-200 border border-zinc-200">
            {[
              { icon: Ruler, title: "Editor 2D con griglia", body: "Pareti, porte, finestre e stanze con snap alla griglia e misure in tempo reale." },
              { icon: Box, title: "Anteprima 3D real-time", body: "Le pareti prendono volume: vedi la stanza mentre la disegni." },
              { icon: Sparkles, title: "Rendering AI fotorealistico", body: "Un click e la tua bozza diventa un render da brochure con Gemini Nano Banana." },
              { icon: Calculator, title: "Preventivo automatico", body: "Costi aggiornati per m² di pavimento, pareti, impianti e arredi." },
              { icon: Layers, title: "Catalogo modificabile", body: "Prezzi e materiali sotto il tuo controllo: personalizzali per ogni cliente." },
              { icon: FileText, title: "PDF professionale", body: "Esporta il preventivo con planimetria, render e voci di costo dettagliate." },
            ].map((f, i) => (
              <div key={i} className="bg-white p-8 hover:bg-zinc-50 transition-colors">
                <div className="w-10 h-10 border border-zinc-900 flex items-center justify-center mb-4">
                  <f.icon size={18} strokeWidth={2} />
                </div>
                <div className="font-medium text-zinc-900 mb-2" style={{ fontFamily: "Outfit" }}>{f.title}</div>
                <p className="text-sm text-zinc-600 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SHOWCASE */}
      <section className="max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-10 items-center border-b border-zinc-200">
        <div>
          <div className="label-kicker mb-4">Un flusso unico</div>
          <h3 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-6" style={{ fontFamily: "Outfit" }}>
            Pianta → 3D → Render → Preventivo → PDF.
          </h3>
          <p className="text-zinc-600 leading-relaxed mb-6">
            Pensato per chi fa ristrutturazioni sul serio: geometri, imprese edili, interior designer e proprietari che vogliono capire <em>prima</em> cosa stanno spendendo.
          </p>
          <ul className="space-y-3 mono text-sm text-zinc-700">
            <li>— Snap a 5 cm, angoli 15°, quote in tempo reale</li>
            <li>— 5 categorie di materiali + 10 tipi di arredo inclusi</li>
            <li>— Preventivo aggiornato ad ogni modifica del disegno</li>
            <li>— Multi-progetto con login sicuro</li>
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <img src={FEATURE_1} alt="costruzione" className="w-full aspect-[3/4] object-cover border border-zinc-200" />
          <img src={FEATURE_2} alt="planimetria" className="w-full aspect-[3/4] object-cover border border-zinc-200 mt-10" />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-zinc-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-10 items-center">
          <h3 className="text-4xl font-semibold tracking-tight" style={{ fontFamily: "Outfit" }}>
            Il tuo prossimo preventivo <span className="text-zinc-400">inizia qui.</span>
          </h3>
          <div className="flex items-center gap-3 md:justify-end">
            <Link to="/register" data-testid="footer-cta-register">
              <Button size="lg" className="rounded-sm bg-white text-zinc-900 hover:bg-zinc-200 h-12 px-6">
                Crea un account <ArrowRight size={16} className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-200 py-8 text-center text-xs text-zinc-500 mono">
        © {new Date().getFullYear()} Ristruttura.CAD — progetta · preventiva · renderizza
      </footer>
    </div>
  );
}
