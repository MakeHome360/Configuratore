import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Plus, Trash2, Star, StarOff } from "lucide-react";
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
  const [dati, setDati] = useState({ nome: "", email: "", telefono: "", piva: "", indirizzo: "", sito: "", logo: "", colore_primario: "teal", payment_presets: [] });
  useEffect(() => { api.get("/dati-azienda").then((r) => r.data && setDati({ ...r.data, payment_presets: r.data.payment_presets || [] })); }, []);
  const save = async () => { await api.put("/dati-azienda", dati); toast.success("Salvato. Ricarica per applicare i colori."); setTimeout(() => window.location.reload(), 800); };

  // Helpers preset pagamento
  const presets = dati.payment_presets || [];
  const addPreset = () => setDati({ ...dati, payment_presets: [...presets, { id: `pp-${Date.now()}`, nome: "Nuovo preset", default: presets.length === 0, rate: [{ descrizione: "Acconto alla firma", pct: 30 }, { descrizione: "Saldo a fine lavori", pct: 70 }] }] });
  const updPreset = (i, k, v) => setDati({ ...dati, payment_presets: presets.map((p, j) => j === i ? { ...p, [k]: v } : p) });
  const setDefaultPreset = (i) => setDati({ ...dati, payment_presets: presets.map((p, j) => ({ ...p, default: j === i })) });
  const delPreset = (i) => setDati({ ...dati, payment_presets: presets.filter((_, j) => j !== i) });
  const addRata = (i) => updPreset(i, "rate", [...(presets[i].rate || []), { descrizione: "Rata", pct: 0 }]);
  const updRata = (i, ri, k, v) => updPreset(i, "rate", (presets[i].rate || []).map((r, rj) => rj === ri ? { ...r, [k]: v } : r));
  const delRata = (i, ri) => updPreset(i, "rate", (presets[i].rate || []).filter((_, rj) => rj !== ri));

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
        {/* Condizioni di pagamento: testo libero usato nel riepilogo preventivo stampabile */}
        <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-3 mt-4">
          <h3 className="font-semibold">Condizioni di pagamento (mostrate nel preventivo stampato)</h3>
          <p className="text-xs text-zinc-500">Inserisci una riga per ogni step. Esempio: <em>"30% alla firma del contratto"</em>. Lasciare vuoto per ometterle del tutto. Possono essere comunque concordate caso per caso.</p>
          <textarea
            value={dati.condizioni_pagamento || ""}
            onChange={(e) => setDati({ ...dati, condizioni_pagamento: e.target.value })}
            rows={6}
            className="w-full border border-zinc-300 rounded p-2 text-sm mono"
            placeholder={"Es:\n30% alla firma del contratto come acconto\n20% all'inizio dei lavori\n30% durante i lavori (SAL)\n20% a saldo alla consegna"}
            data-testid="dati-condizioni-pagamento"
          />
        </div>
        {/* Preset modalità di pagamento */}
        <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-3 mt-4" data-testid="payment-presets-section">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Modalità di pagamento (preset)</h3>
              <p className="text-xs text-zinc-500">Crea schemi pagamento pronti (es. 30/40/30, 30/20/30/20, "a misura"). Il venditore potrà selezionarli direttamente in fase di preventivo o personalizzarli. Il preset con ★ è quello pre-selezionato di default.</p>
            </div>
            <Button size="sm" onClick={addPreset} data-testid="add-preset" style={{ background: "var(--brand)", color: "white" }}><Plus className="h-4 w-4 mr-1" /> Nuovo preset</Button>
          </div>
          {presets.length === 0 && <div className="text-center text-xs text-zinc-400 py-6">Nessun preset. Clicca "Nuovo preset" per crearne uno.</div>}
          <div className="space-y-3">
            {presets.map((p, i) => {
              const tot = (p.rate || []).reduce((s, r) => s + (parseFloat(r.pct) || 0), 0);
              return (
                <div key={p.id || i} className="border border-zinc-200 rounded p-3 space-y-2" data-testid={`preset-${i}`}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setDefaultPreset(i)} className="text-amber-500 hover:text-amber-600" title={p.default ? "Default" : "Imposta default"} data-testid={`preset-default-${i}`}>
                      {p.default ? <Star className="h-4 w-4 fill-amber-500" /> : <StarOff className="h-4 w-4" />}
                    </button>
                    <Input value={p.nome} onChange={e => updPreset(i, "nome", e.target.value)} placeholder="Nome preset (es. 30/40/30)" className="flex-1" data-testid={`preset-nome-${i}`} />
                    <span className={`text-xs font-mono ${Math.abs(tot - 100) > 0.01 ? "text-rose-600" : "text-emerald-600"}`}>Totale {tot.toFixed(1)}%</span>
                    <button onClick={() => delPreset(i)} className="text-rose-600 p-1.5 hover:bg-rose-50 rounded" title="Elimina preset" data-testid={`preset-del-${i}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="space-y-1.5">
                    {(p.rate || []).map((r, ri) => (
                      <div key={ri} className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400 w-6 text-right">{ri + 1}.</span>
                        <Input value={r.descrizione} onChange={e => updRata(i, ri, "descrizione", e.target.value)} placeholder="Es. Acconto alla firma" className="flex-1 h-8 text-sm" data-testid={`rata-desc-${i}-${ri}`} />
                        <Input type="number" step="0.5" value={r.pct} onChange={e => updRata(i, ri, "pct", parseFloat(e.target.value) || 0)} className="w-20 h-8 text-right mono text-sm" data-testid={`rata-pct-${i}-${ri}`} />
                        <span className="text-xs text-zinc-500">%</span>
                        <button onClick={() => delRata(i, ri)} className="text-rose-500 p-1 hover:bg-rose-50 rounded" data-testid={`rata-del-${i}-${ri}`}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                    <button onClick={() => addRata(i)} className="text-xs text-blue-600 hover:underline" data-testid={`rata-add-${i}`}>+ Aggiungi rata</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Page>
    </div>
  );
}
