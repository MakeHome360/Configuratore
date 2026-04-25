import React, { useEffect, useState } from "react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { api } from "../lib/api";
import { toast } from "sonner";
import { RotateCcw, Save, Upload, Sparkles, X, Loader2 } from "lucide-react";
import CsvImportDialog from "../components/CsvImportDialog";
import { fmtEuro } from "../editor/utils";

const CATEGORIES = [
  { id: "floor", label: "Pavimenti", unit: "€/m²" },
  { id: "wall", label: "Pareti", unit: "€/m²" },
  { id: "ceiling", label: "Soffitti", unit: "€/m²" },
  { id: "electrical", label: "Impianto elettrico", unit: "€/m²" },
  { id: "plumbing", label: "Impianto idraulico", unit: "€/m²" },
  { id: "furniture", label: "Arredi", unit: "€/pz" },
  { id: "fixture", label: "Sanitari", unit: "€/pz" },
  { id: "appliance", label: "Elettrodomestici", unit: "€/pz" },
  { id: "light", label: "Illuminazione", unit: "€/pz" },
];

export default function Materials() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState({});
  const [importing, setImporting] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [activeCat, setActiveCat] = useState(CATEGORIES[0].id);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/materials");
      setItems(data);
    } catch { toast.error("Errore caricamento catalogo"); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const editPrice = (id, price) => {
    setItems((arr) => arr.map((it) => (it.id === id ? { ...it, price } : it)));
    setDirty((d) => ({ ...d, [id]: true }));
  };

  const saveAll = async () => {
    const ids = Object.keys(dirty);
    try {
      await Promise.all(ids.map((id) => {
        const it = items.find((x) => x.id === id);
        return api.put(`/materials/${id}`, { price: parseFloat(it.price) || 0 });
      }));
      setDirty({});
      toast.success("Prezzi aggiornati");
    } catch { toast.error("Errore salvataggio"); }
  };

  const resetCatalog = async () => {
    if (!window.confirm("Ripristinare i prezzi di default?")) return;
    try {
      const { data } = await api.post("/materials/reset");
      setItems(data); setDirty({});
      toast.success("Catalogo ripristinato");
    } catch { toast.error("Errore"); }
  };

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-6xl mx-auto px-6 py-10" data-testid="materials-page">
        <div className="flex items-end justify-between mb-8 border-b border-zinc-200 pb-6">
          <div>
            <div className="label-kicker mb-2">Catalogo</div>
            <h1 className="text-4xl font-semibold tracking-tight" style={{ fontFamily: "Outfit" }}>Materiali e prezzi</h1>
            <p className="text-sm text-zinc-500 mt-2">Personalizza i costi che useremo nei preventivi.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setAiOpen(true)} className="rounded-sm bg-violet-600 hover:bg-violet-700 text-white" data-testid="materials-ai-button">
              <Sparkles size={14} className="mr-2" /> Genera con AI
            </Button>
            <Button variant="outline" onClick={() => setImporting(true)} className="rounded-sm" data-testid="materials-import-csv">
              <Upload size={14} className="mr-2" /> Importa CSV
            </Button>
            <Button variant="outline" onClick={resetCatalog} className="rounded-sm" data-testid="materials-reset-button">
              <RotateCcw size={14} className="mr-2" /> Reset default
            </Button>
            <Button onClick={saveAll} disabled={Object.keys(dirty).length === 0} className="rounded-sm bg-zinc-900 hover:bg-zinc-800" data-testid="materials-save-button">
              <Save size={14} className="mr-2" /> Salva {Object.keys(dirty).length > 0 && `(${Object.keys(dirty).length})`}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-zinc-500 mono text-sm">caricamento…</div>
        ) : (
          <Tabs value={activeCat} onValueChange={setActiveCat}>
            <TabsList className="bg-transparent p-0 h-auto flex flex-wrap gap-1 border-b border-zinc-200 rounded-none w-full justify-start">
              {CATEGORIES.map((c) => (
                <TabsTrigger
                  key={c.id}
                  value={c.id}
                  className="rounded-none data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:shadow-none text-xs uppercase tracking-widest"
                  data-testid={`materials-tab-${c.id}`}
                >
                  {c.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {CATEGORIES.map((c) => {
              const list = items.filter((it) => it.category === c.id);
              return (
                <TabsContent key={c.id} value={c.id} className="mt-8">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-xs text-zinc-500 uppercase tracking-widest">
                        <th className="text-left py-3 font-medium">Materiale</th>
                        <th className="text-left py-3 font-medium w-24">Unità</th>
                        <th className="text-right py-3 font-medium w-48">Prezzo ({c.unit})</th>
                        <th className="text-right py-3 font-medium w-32">Attuale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((it) => (
                        <tr key={it.id} className="border-b border-zinc-100 hover:bg-zinc-50" data-testid={`material-row-${it.id}`}>
                          <td className="py-3 flex items-center gap-3">
                            {it.thumb ? (
                              <img src={it.thumb} alt="" className="w-10 h-10 object-cover border border-zinc-200 rounded-sm" />
                            ) : (
                              <span className="w-5 h-5 border border-zinc-200" style={{ background: it.color }} />
                            )}
                            <div>
                              <div>{it.name}</div>
                              {it.description && <div className="text-[10px] text-zinc-500">{it.description}</div>}
                            </div>
                          </td>
                          <td className="py-3 mono text-zinc-500">{it.unit}</td>
                          <td className="py-3 text-right">
                            <Input
                              type="number"
                              value={it.price}
                              onChange={(e) => editPrice(it.id, e.target.value)}
                              className="rounded-sm h-9 text-right mono w-36 ml-auto"
                              data-testid={`material-price-${it.id}`}
                            />
                          </td>
                          <td className="py-3 text-right mono text-zinc-900">{fmtEuro(parseFloat(it.price) || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </main>
      {importing && <CsvImportDialog endpoint="/materials/bulk-import" header="category,name,unit,cost,color" example='floor,Gres porcellanato 60x60,€/m²,42.50,#D4D4D8' title="Importa Materiali da CSV" onClose={() => setImporting(false)} onSuccess={load} />}
      {aiOpen && <AiMaterialDialog defaultCategory={activeCat} onClose={() => setAiOpen(false)} onCreated={load} />}
    </div>
  );
}

function AiMaterialDialog({ defaultCategory, onClose, onCreated }) {
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState(defaultCategory || "fixture");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null); // {material, image_data_url}

  const generate = async () => {
    if (!prompt.trim()) return toast.error("Descrivi cosa vuoi generare");
    setLoading(true); setPreview(null);
    try {
      const { data } = await api.post("/materials/ai-generate", { prompt, category });
      setPreview(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Errore generazione AI");
    }
    setLoading(false);
  };

  const save = async () => {
    if (!preview) return;
    try {
      await api.post("/materials", {
        ...preview.material,
        thumb: preview.image_data_url,
      });
      toast.success("Materiale aggiunto al catalogo");
      onCreated();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Errore salvataggio");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose} data-testid="ai-material-dialog">
      <div className="bg-white rounded-lg w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="font-semibold text-lg flex items-center gap-2" style={{ fontFamily: "Outfit" }}>
            <Sparkles className="h-5 w-5 text-violet-600" /> Genera materiale con AI
          </h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-500">Categoria</label>
            <select className="w-full h-10 px-2 border border-zinc-300 rounded mt-1" value={category} onChange={(e) => setCategory(e.target.value)} data-testid="ai-mat-cat">
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-500">Descrizione</label>
            <Input
              placeholder='es. "Sanitario sospeso bianco minimal", "Piastrella effetto marmo nero 60x60", "Lampadario LED moderno camera"'
              value={prompt} onChange={(e) => setPrompt(e.target.value)}
              className="mt-1"
              data-testid="ai-mat-prompt"
              disabled={loading}
              onKeyDown={(e) => { if (e.key === "Enter" && !loading) generate(); }}
            />
            <div className="text-[11px] text-zinc-500 mt-1 italic">L'AI genererà nome, descrizione, prezzo medio realistico, colore e <strong>foto del prodotto</strong>.</div>
          </div>
          {preview && (
            <div className="border border-violet-200 bg-violet-50/40 rounded p-4 mt-2" data-testid="ai-mat-preview">
              <div className="flex gap-4 items-start">
                {preview.image_data_url ? (
                  <img src={preview.image_data_url} alt="" className="w-32 h-32 object-cover rounded border border-zinc-200" />
                ) : (
                  <div className="w-32 h-32 rounded border border-zinc-200 flex items-center justify-center text-xs text-zinc-400" style={{ background: preview.material.color }}>
                    no img
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <div>
                    <Input value={preview.material.name} onChange={(e) => setPreview({ ...preview, material: { ...preview.material, name: e.target.value } })} className="font-semibold" data-testid="ai-mat-name" />
                  </div>
                  <div className="text-sm text-zinc-600">{preview.material.description}</div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-zinc-500">Prezzo:</span>
                    <Input type="number" step="0.01" value={preview.material.price} onChange={(e) => setPreview({ ...preview, material: { ...preview.material, price: Number(e.target.value) } })} className="w-28 text-right mono" />
                    <span className="text-xs text-zinc-500">{preview.material.unit}</span>
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-500">
                      colore <span className="w-5 h-5 border border-zinc-300 rounded-sm" style={{ background: preview.material.color }} />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2 bg-zinc-50">
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          {!preview ? (
            <Button onClick={generate} disabled={loading || !prompt.trim()} className="bg-violet-600 hover:bg-violet-700 text-white" data-testid="ai-mat-generate-btn">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generazione…</> : <><Sparkles className="h-4 w-4 mr-2" /> Genera</>}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => { setPreview(null); }}>Rigenera</Button>
              <Button onClick={save} className="bg-zinc-900 hover:bg-zinc-800 text-white" data-testid="ai-mat-save-btn">
                <Save className="h-4 w-4 mr-2" />Aggiungi al catalogo
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
