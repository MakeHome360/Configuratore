import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { toast } from "sonner";

const COLORS = [
  { k: "teal", label: "Teal (Verde Acqua)", color: "#0F766E" },
  { k: "blue", label: "Blu", color: "#1D4ED8" },
  { k: "emerald", label: "Smeraldo", color: "#047857" },
  { k: "violet", label: "Viola", color: "#6D28D9" },
  { k: "amber", label: "Ambra", color: "#B45309" },
  { k: "rose", label: "Rosa", color: "#BE185D" },
];

export default function AdminDatiAzienda() {
  const [dati, setDati] = useState({ nome: "", email: "", telefono: "", piva: "", indirizzo: "", sito: "", logo: "", colore_primario: "teal" });
  useEffect(() => { api.get("/dati-azienda").then((r) => r.data && setDati(r.data)); }, []);
  const save = async () => { await api.put("/dati-azienda", dati); toast.success("Salvato. Ricarica per applicare i colori."); setTimeout(() => window.location.reload(), 800); };

  return (
    <div>
      <PageHeader title="Dati Azienda" subtitle="Configura i dati aziendali e il branding"
        actions={<Button onClick={save} data-testid="az-save" style={{ background: "var(--brand)", color: "white" }}><Save className="h-4 w-4 mr-2" />Salva</Button>} />
      <Page>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-5xl">
          <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
            <h3 className="font-semibold">Informazioni Principali</h3>
            <div><Label>Nome Azienda *</Label><Input value={dati.nome} onChange={(e) => setDati({ ...dati, nome: e.target.value })} data-testid="az-nome" /></div>
            <div><Label>Email Aziendale</Label><Input value={dati.email} onChange={(e) => setDati({ ...dati, email: e.target.value })} /></div>
            <div><Label>Telefono</Label><Input value={dati.telefono} onChange={(e) => setDati({ ...dati, telefono: e.target.value })} /></div>
            <div><Label>Partita IVA</Label><Input value={dati.piva} onChange={(e) => setDati({ ...dati, piva: e.target.value })} /></div>
            <div><Label>Indirizzo Sede</Label><Input value={dati.indirizzo} onChange={(e) => setDati({ ...dati, indirizzo: e.target.value })} /></div>
            <div><Label>Sito Web</Label><Input value={dati.sito} onChange={(e) => setDati({ ...dati, sito: e.target.value })} /></div>
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
            <h3 className="font-semibold">Branding</h3>
            <div>
              <Label>Logo (URL)</Label>
              <Input value={dati.logo || ""} onChange={(e) => setDati({ ...dati, logo: e.target.value })} placeholder="https://..." />
              <div className="text-xs text-zinc-500 mt-1">Formato consigliato: PNG trasparente, 200x60px</div>
              {dati.logo && <img src={dati.logo} alt="logo" className="mt-2 h-12 border border-zinc-200 rounded p-1" />}
            </div>
            <div>
              <Label>Colore Primario</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {COLORS.map((c) => (
                  <button key={c.k} onClick={() => setDati({ ...dati, colore_primario: c.k })} data-testid={`color-${c.k}`}
                    className={`p-2 rounded border-2 flex items-center gap-2 ${dati.colore_primario === c.k ? "border-zinc-900" : "border-zinc-200"}`}>
                    <div className="h-5 w-5 rounded" style={{ background: c.color }} />
                    <span className="text-xs">{c.label}</span>
                  </button>
                ))}
              </div>
              <div className="text-xs text-zinc-500 mt-2">Il colore verrà applicato a menu, pulsanti e elementi principali.</div>
            </div>
            <div className="mt-4 p-3 bg-zinc-50 rounded">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Anteprima Header</div>
              <div className="rounded p-3 flex items-center gap-2" style={{ background: COLORS.find(c => c.k === dati.colore_primario)?.color || "#0F766E", color: "white" }}>
                {dati.logo ? <img src={dati.logo} className="h-6" alt="" /> : <span className="font-bold">{(dati.nome || "I")[0]}</span>}
                <span className="font-semibold">{dati.nome || "CONFIGURATORE"}</span>
              </div>
            </div>
          </div>
        </div>
      </Page>
    </div>
  );
}
