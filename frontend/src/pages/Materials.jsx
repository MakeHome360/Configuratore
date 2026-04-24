import React, { useEffect, useState } from "react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { api } from "../lib/api";
import { toast } from "sonner";
import { RotateCcw, Save, Upload } from "lucide-react";
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
          <Tabs defaultValue={CATEGORIES[0].id}>
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
                            <span className="w-5 h-5 border border-zinc-200" style={{ background: it.color }} />
                            {it.name}
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
    </div>
  );
}
