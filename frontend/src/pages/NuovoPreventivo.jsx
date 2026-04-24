import React from "react";
import { useNavigate } from "react-router-dom";
import { Page, PageHeader } from "@/components/ui-kit";
import { Home, Bath, Layers, Square } from "lucide-react";

const TYPES = [
  { key: "pacchetto", to: "/preventivopacchetto", icon: Home, title: "Ristrutturazione a Pacchetto", desc: "Scegli uno dei 4 pacchetti completi (BASIC, SMART, PREMIUM, ELITE) con tutto incluso", color: "#0F766E" },
  { key: "bagno", to: "/preventivobagno", icon: Bath, title: "Solo Bagno", desc: "Ristrutturazione completa del solo bagno chiavi in mano", color: "#0EA5E9" },
  { key: "composite", to: "/preventivocomposite", icon: Layers, title: "Composite", desc: "Configura la tua ristrutturazione pezzo per pezzo, sezione per sezione", color: "#8B5CF6" },
  { key: "infissi", to: "/preventivoinfissi", icon: Square, title: "Solo Infissi", desc: "Preventivo dedicato a finestre, porte, portefinestre e serramenti. Scegli materiale, vetro e dimensioni per ogni elemento.", color: "#F59E0B" },
];

export default function NuovoPreventivo() {
  const nav = useNavigate();
  return (
    <div>
      <PageHeader title="Nuovo Preventivo" subtitle="Scegli il tipo di preventivo da creare" />
      <Page>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl">
          {TYPES.map((t) => (
            <button
              key={t.key}
              data-testid={`card-preventivo-${t.key}`}
              onClick={() => nav(t.to)}
              className="text-left bg-white border border-zinc-200 rounded-xl p-6 hover:shadow-md transition-all hover:-translate-y-0.5 group"
            >
              <div className="h-12 w-12 rounded-lg flex items-center justify-center mb-4" style={{ background: t.color + "20", color: t.color }}>
                <t.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold mb-1 text-zinc-900">{t.title}</h3>
              <p className="text-sm text-zinc-600 mb-4 leading-relaxed">{t.desc}</p>
              <div className="text-sm font-semibold group-hover:underline" style={{ color: t.color }}>Inizia →</div>
            </button>
          ))}
        </div>
      </Page>
    </div>
  );
}
