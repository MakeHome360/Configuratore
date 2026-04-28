import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { 
  ArrowRight, 
  CheckCircle2, 
  Compass, 
  Ruler, 
  Layers, 
  PenTool, 
  MonitorPlay,
  ShieldCheck,
  Calculator,
  HardHat,
  Clock,
  Euro
} from 'lucide-react';

const Landing = () => {
  return (
    <div className="min-h-screen bg-[#F7F7F5] font-sans selection:bg-[#B34A31] selection:text-white">
      <Navbar />

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Typography & CTA */}
            <div className="lg:col-span-6 lg:pr-8 space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EDEDE8] border border-[#E0DFD8]">
                <span className="w-2 h-2 rounded-full bg-[#B34A31] animate-pulse"></span>
                <span className="text-xs font-mono font-medium tracking-wider text-[#5C5C59] uppercase">
                  Il primo studio edile Tech in Italia
                </span>
              </div>
              
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-serif text-[#1C1C1A] leading-[1.1] tracking-tight">
                L'arte di <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1C1C1A] to-[#6A6A64]">
                  ristrutturare,
                </span><br />
                ingegnerizzata.
              </h1>
              
              <p className="text-lg sm:text-xl text-[#5C5C59] max-w-lg leading-relaxed font-light">
                Dall'idea al cantiere, con trasparenza totale. Visualizza la tua nuova casa in 3D fotorealistico prima ancora di iniziare, e ottieni un preventivo garantito al millimetro.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link 
                  to="/configuratoreesigenze" 
                  className="group flex justify-center items-center gap-2 bg-[#B34A31] text-white px-8 py-4 rounded hover:bg-[#963820] transition-colors text-base font-medium"
                  data-testid="hero-primary-cta"
                >
                  Configura il tuo preventivo
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link 
                  to="/progetti" 
                  className="flex justify-center items-center gap-2 bg-white text-[#1C1C1A] border border-[#E0DFD8] px-8 py-4 rounded hover:bg-[#EDEDE8] transition-colors text-base font-medium"
                  data-testid="hero-secondary-cta"
                >
                  <MonitorPlay className="w-4 h-4" />
                  Apri Editor Demo
                </Link>
              </div>
              
              <div className="flex items-center gap-4 pt-4">
                <div className="flex -space-x-3">
                  {[1, 2, 3].map((i) => (
                    <img 
                      key={i} 
                      src={`https://i.pravatar.cc/100?img=${i + 10}`} 
                      alt="Cliente" 
                      className="w-10 h-10 rounded-full border-2 border-[#F7F7F5]" 
                    />
                  ))}
                </div>
                <div className="text-sm font-medium text-[#5C5C59]">
                  Oltre <strong className="text-[#1C1C1A]">500+</strong> cantieri consegnati in tempo.
                </div>
              </div>
            </div>

            {/* Hero Visuals */}
            <div className="lg:col-span-6 relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl aspect-[4/5] sm:aspect-square lg:aspect-[4/5] bg-gray-200">
                <img 
                  src="https://images.unsplash.com/photo-1703867110051-a0eb1e77b967?crop=entropy&cs=srgb&fm=jpg&q=85" 
                  alt="Modern Interior Design" 
                  className="w-full h-full object-cover"
                />
                {/* Floating Tech Element */}
                <div className="absolute bottom-6 left-6 right-6 bg-white/80 backdrop-blur-xl border border-white/40 p-5 rounded-xl shadow-xl flex items-start gap-4">
                  <div className="bg-[#1C1C1A] text-white p-3 rounded-lg">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-[#1C1C1A]">Rendering Live 3D</h4>
                    <p className="text-sm font-sans text-[#5C5C59]">Calcolo computo metrico in tempo reale</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COSA FACCIAMO (SERVICES) */}
      <section id="servizi" className="py-24 bg-white border-y border-[#E0DFD8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-[#B34A31] font-mono tracking-widest text-sm uppercase">Cosa Facciamo</h2>
            <h3 className="text-4xl sm:text-5xl font-serif text-[#1C1C1A]">I nostri servizi</h3>
            <p className="text-[#5C5C59] text-lg">Soluzioni complete per valorizzare il tuo immobile, gestite da un unico interlocutore affidabile e tecnologico.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Ristrutturazioni Chiavi in Mano",
                desc: "Gestiamo tutto noi: dalle pratiche edilizie, al progetto CAD 3D, fino alla consegna chiavi.",
                img: "https://images.unsplash.com/photo-1680209667207-cae0f6cd8fa9?crop=entropy&cs=srgb&fm=jpg&q=85",
                icon: HardHat
              },
              {
                title: "Arredamento su Misura",
                desc: "Progettazione d'interni con rendering AI fotorealistico. Scegli le finiture prima di comprare.",
                img: "https://images.pexels.com/photos/33599113/pexels-photo-33599113.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
                icon: Compass
              },
              {
                title: "Gestione Immobiliare",
                desc: "Valorizzazione asset e property management per investitori che cercano rendite sicure.",
                img: "https://images.pexels.com/photos/37175977/pexels-photo-37175977.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
                icon: Ruler
              }
            ].map((service, idx) => (
              <div key={idx} className="group cursor-pointer">
                <div className="relative overflow-hidden rounded-xl aspect-[4/3] mb-6">
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors z-10" />
                  <img 
                    src={service.img} 
                    alt={service.title} 
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute bottom-4 left-4 z-20 bg-white p-3 rounded-full shadow-lg">
                    <service.icon className="w-6 h-6 text-[#1C1C1A]" />
                  </div>
                </div>
                <h4 className="text-2xl font-serif text-[#1C1C1A] mb-2 group-hover:text-[#B34A31] transition-colors">{service.title}</h4>
                <p className="text-[#5C5C59]">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TECNOLOGIA (THE DIFFERENTIATOR) */}
      <section id="tecnologia" className="py-24 bg-[#1C1C1A] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <h2 className="text-[#B34A31] font-mono tracking-widest text-sm uppercase">Il nostro vantaggio sleale</h2>
              <h3 className="text-4xl sm:text-5xl font-serif leading-tight">
                Non immaginiamo il tuo futuro, <span className="italic text-gray-400">lo calcoliamo.</span>
              </h3>
              
              <div className="space-y-6">
                {[
                  {
                    title: "Progettazione CAD 2D/3D Live",
                    desc: "Il nostro editor proprietario ci permette di tracciare muri e impianti in tempo reale, restituendoti misure precise al millimetro.",
                    icon: PenTool
                  },
                  {
                    title: "Rendering AI Fotorealistico",
                    desc: "Applica finiture, pavimenti e luci per vedere il risultato finale. Niente più brutte sorprese o materiali che non si abbinano.",
                    icon: MonitorPlay
                  },
                  {
                    title: "Portale Cliente & Firma Digitale",
                    desc: "Accedi al tuo spazio privato per monitorare il cantiere, approvare il capitolato e firmare i documenti via OTP.",
                    icon: ShieldCheck
                  }
                ].map((tech, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">
                    <div className="flex-shrink-0 bg-white/10 p-3 rounded-lg h-fit">
                      <tech.icon className="w-6 h-6 text-[#B34A31]" />
                    </div>
                    <div>
                      <h4 className="text-xl font-medium mb-1">{tech.title}</h4>
                      <p className="text-gray-400 font-light leading-relaxed">{tech.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              {/* Abstract representation of CAD to Reality */}
              <div className="aspect-square bg-[#2A2A28] rounded-2xl border border-white/10 p-2 overflow-hidden shadow-2xl relative group">
                {/* Simulated Grid / CAD background */}
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#404040 1px, transparent 1px), linear-gradient(90deg, #404040 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                
                <img 
                  src="https://images.unsplash.com/photo-1717445130372-e50b9b45a669?crop=entropy&cs=srgb&fm=jpg&q=85" 
                  alt="Architectural Sketch" 
                  className="w-full h-full object-cover rounded-xl mix-blend-luminosity opacity-80 group-hover:opacity-0 transition-opacity duration-1000 absolute top-2 left-2 right-2 bottom-2"
                />
                
                <img 
                  src="https://images.pexels.com/photos/34277650/pexels-photo-34277650.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" 
                  alt="Realistic Render" 
                  className="w-full h-full object-cover rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 absolute top-2 left-2 right-2 bottom-2 z-10"
                />

                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 text-sm font-mono tracking-widest text-white whitespace-nowrap">
                  Hover to Render
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PACCHETTI (PRICING) */}
      <section id="pacchetti" className="py-24 bg-[#F7F7F5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-[#B34A31] font-mono tracking-widest text-sm uppercase">Trasparenza Totale</h2>
            <h3 className="text-4xl sm:text-5xl font-serif text-[#1C1C1A]">I nostri pacchetti</h3>
            <p className="text-[#5C5C59] text-lg">Nessun costo nascosto. Scegli il livello di finitura più adatto alle tue esigenze e conosci subito il budget indicativo.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {[
              { name: "BASIC", price: "380€", target: "Standard", features: ["Demolizioni essenziali", "Impianti a norma", "Pavimenti in gres", "Sanitari filo muro", "Tinteggiatura bianca"] },
              { name: "SMART", price: "490€", target: "Qualità/Prezzo", popular: true, features: ["Tutto in Basic", "Pavimenti grandi formati", "Porte laminato premium", "Infissi doppio vetro", "Controsoffitti design"] },
              { name: "PREMIUM", price: "790€", target: "Lusso Elegante", features: ["Tutto in Smart", "Parquet rovere", "Sanitari sospesi design", "Infissi triplo vetro", "Domotica base"] },
              { name: "ELITE", price: "1180€", target: "Senza Compromessi", features: ["Tutto in Premium", "Materiali pregio (Marmo)", "Domotica avanzata", "Progetto illuminotecnico", "Arredi su misura inclusi"] }
            ].map((pkg, i) => (
              <div key={i} className={`relative bg-white rounded-xl border ${pkg.popular ? 'border-[#B34A31] shadow-xl relative -translate-y-2' : 'border-[#E0DFD8]'} p-8 flex flex-col`}>
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#B34A31] text-white text-xs font-mono px-3 py-1 rounded-full uppercase tracking-wider">
                    Più Scelto
                  </div>
                )}
                <div className="mb-8">
                  <h4 className="text-xl font-serif font-bold text-[#1C1C1A] mb-1">{pkg.name}</h4>
                  <p className="text-sm text-[#5C5C59] mb-4">{pkg.target}</p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-light text-[#1C1C1A]">a partire da</span>
                  </div>
                  <div className="flex items-end gap-1 mt-2">
                    <span className="text-4xl font-serif font-bold text-[#1C1C1A]">{pkg.price}</span>
                    <span className="text-[#5C5C59] font-mono">/m²</span>
                  </div>
                </div>
                
                <ul className="space-y-4 mb-8 flex-grow">
                  {pkg.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-[#B34A31] shrink-0 mt-0.5" />
                      <span className="text-sm text-[#5C5C59] font-medium">{feat}</span>
                    </li>
                  ))}
                </ul>
                
                <Link 
                  to="/configuratoreesigenze" 
                  className={`w-full py-3 px-4 rounded font-medium transition-colors text-center ${
                    pkg.popular 
                      ? 'bg-[#1C1C1A] text-white hover:bg-black' 
                      : 'bg-[#EDEDE8] text-[#1C1C1A] hover:bg-[#E0DFD8]'
                  }`}
                  data-testid={`pkg-btn-${pkg.name.toLowerCase()}`}
                >
                  Calcola preventivo
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PERCHÈ RISTRUTTURA.CAD (BENEFITS) */}
      <section className="py-24 bg-white border-y border-[#E0DFD8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h3 className="text-3xl sm:text-4xl font-serif text-[#1C1C1A] mb-4">Perché scegliere noi</h3>
            <p className="text-[#5C5C59]">Abbiamo eliminato le zone grigie delle ristrutturazioni classiche.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
            {[
              { title: "Trasparenza Prezzi", desc: "Ogni vite è inserita nel computo. Nessun aumento del budget in corso d'opera.", icon: Euro },
              { title: "Capitolato Dettagliato", desc: "Schede tecniche, brand e modelli di ogni materiale scelto tramite l'editor.", icon: Layers },
              { title: "Cantiere Monitorato", desc: "Aggiornamenti fotografici giornalieri direttamente sul tuo Portale Cliente.", icon: HardHat },
              { title: "Garanzia 5 Anni", desc: "Siamo così sicuri dei nostri artigiani che estendiamo la garanzia di legge.", icon: ShieldCheck },
              { title: "Tempi Certi", desc: "Penali a nostro carico per ogni giorno di ritardo sulla consegna concordata.", icon: Clock },
              { title: "Preventivi Immediati", desc: "Grazie all'IA, ottieni una stima accurata in 5 minuti rispondendo a poche domande.", icon: Calculator }
            ].map((benefit, i) => (
              <div key={i} className="flex gap-4">
                <div className="bg-[#F7F7F5] p-4 rounded-xl h-fit border border-[#E0DFD8]">
                  <benefit.icon className="w-6 h-6 text-[#1C1C1A]" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-[#1C1C1A] mb-2 font-serif">{benefit.title}</h4>
                  <p className="text-sm text-[#5C5C59] leading-relaxed">{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CALL TO ACTION */}
      <section className="py-24 bg-[#B34A31] text-white">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-8">
          <h2 className="text-4xl sm:text-5xl font-serif font-bold">Pronto a trasformare la tua casa?</h2>
          <p className="text-xl opacity-90 font-light max-w-2xl mx-auto">
            Usa il nostro configuratore AI per ottenere un preventivo dettagliato in meno di 5 minuti, senza alcun impegno.
          </p>
          <div className="pt-4 flex justify-center">
            <Link 
              to="/configuratoreesigenze" 
              className="bg-white text-[#B34A31] px-10 py-5 rounded-lg font-bold text-lg hover:bg-[#F7F7F5] transition-colors shadow-2xl hover:-translate-y-1 transform duration-200"
              data-testid="bottom-primary-cta"
            >
              Inizia la Configurazione Gratuita
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#1C1C1A] text-gray-400 py-16 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="space-y-4">
            <span className="font-serif text-2xl font-bold tracking-tight text-white block">
              Ristruttura<span className="text-[#B34A31]">.CAD</span>
            </span>
            <p className="text-sm leading-relaxed">
              Piattaforma tecnologica per ristrutturazioni chiavi in mano. Design, tecnologia ed esecuzione perfetta.
            </p>
          </div>
          
          <div>
            <h5 className="text-white font-bold mb-4 font-sans uppercase text-sm tracking-wider">Azienda</h5>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Chi Siamo</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Progetti</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Tecnologia</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contatti</a></li>
            </ul>
          </div>

          <div>
            <h5 className="text-white font-bold mb-4 font-sans uppercase text-sm tracking-wider">Servizi</h5>
            <ul className="space-y-3 text-sm">
              <li><Link to="/configuratoreesigenze" className="hover:text-white transition-colors">Configuratore Preventivi</Link></li>
              <li><a href="#" className="hover:text-white transition-colors">Ristrutturazioni Complete</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Interior Design 3D</a></li>
            </ul>
          </div>

          <div>
            <h5 className="text-white font-bold mb-4 font-sans uppercase text-sm tracking-wider">Contatti</h5>
            <ul className="space-y-3 text-sm">
              <li>info@ristrutturacad.it</li>
              <li>800 123 456</li>
              <li>Via Milano 10, Roma (IT)</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-8 border-t border-white/10 text-xs flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>&copy; {new Date().getFullYear()} Ristruttura.CAD srl. Tutti i diritti riservati. P.IVA 01234567890</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white">Privacy Policy</a>
            <a href="#" className="hover:text-white">Cookie Policy</a>
            <a href="#" className="hover:text-white">Termini di Servizio</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;