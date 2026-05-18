import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Package } from "lucide-react";
import { toast } from "sonner";

const FASCIA_BADGE = {
  low: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-rose-100 text-rose-800",
};
const FASCIA_LABEL = { low: "BASE", medium: "MEDIA", high: "ALTA" };

/**
 * Dialog picker per selezionare uno o più prodotti dai listini fornitori.
 * Props:
 *   open, onOpenChange
 *   onConfirm(prodotti[]) — chiamato con i prodotti scelti (con qty)
 *   defaultCategoria (string opz.) — pre-seleziona categoria
 *   multi (bool, default true)
 */
export default function ListinoProdottoPicker({ open, onOpenChange, onConfirm, defaultCategoria = "", multi = true }) {
  const [categorie, setCategorie] = useState([]);
  const [categoria, setCategoria] = useState(defaultCategoria);
  const [q, setQ] = useState("");
  const [fascia, setFascia] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  // Map id prodotto → {prodotto, qty}
  const [selected, setSelected] = useState({});

  useEffect(() => {
    if (open) {
      api.get("/fornitori-listini-categorie").then(r => setCategorie(r.data || [])).catch(() => {});
      setSelected({});
      setCategoria(defaultCategoria);
      setQ("");
      setFascia("");
    }
    // eslint-disable-next-line
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (categoria) params.set("categoria", categoria);
    if (q) params.set("q", q);
    if (fascia) params.set("fascia", fascia);
    params.set("max_results", "200");
    const t = setTimeout(() => {
      api.get(`/fornitori-listini-prodotti/cerca?${params.toString()}`)
        .then(r => setResults(r.data || []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [open, categoria, q, fascia]);

  const toggle = (p) => {
    if (!multi) {
      setSelected({ [p.id]: { prodotto: p, qty: 1 } });
      return;
    }
    setSelected(s => {
      const next = { ...s };
      if (next[p.id]) delete next[p.id];
      else next[p.id] = { prodotto: p, qty: 1 };
      return next;
    });
  };
  const setQty = (id, qty) => setSelected(s => s[id] ? { ...s, [id]: { ...s[id], qty } } : s);

  const total = useMemo(() => Object.values(selected).reduce((sum, x) => sum + ((parseFloat(x.qty) || 0) * (x.prodotto.prezzo_rivendita || 0)), 0), [selected]);

  const confirm = () => {
    const items = Object.values(selected).filter(x => (parseFloat(x.qty) || 0) > 0);
    if (!items.length) { toast.error("Seleziona almeno 1 prodotto"); return; }
    onConfirm(items.map(x => ({
      id: x.prodotto.id,
      listino_id: x.prodotto.listino_id,
      listino_nome: x.prodotto.listino_nome,
      fornitore_nome: x.prodotto.fornitore_nome,
      categoria: x.prodotto.categoria,
      codice: x.prodotto.codice,
      nome: x.prodotto.nome,
      descrizione: x.prodotto.descrizione,
      unit: x.prodotto.unit,
      prezzo_netto: x.prodotto.prezzo_netto,
      ricarico: x.prodotto.ricarico,
      prezzo_rivendita: x.prodotto.prezzo_rivendita,
      fascia_prezzo: x.prodotto.fascia_prezzo,
      categoria_dettaglio: x.prodotto.categoria_dettaglio,
      qty: parseFloat(x.qty) || 1,
      importo: (parseFloat(x.qty) || 1) * (x.prodotto.prezzo_rivendita || 0),
    })));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="listino-picker-dialog">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Aggiungi prodotti da Listini Fornitori</DialogTitle></DialogHeader>

        <div className="flex items-center gap-2 flex-wrap py-2">
          <Select value={categoria || "all"} onValueChange={v => setCategoria(v === "all" ? "" : v)}>
            <SelectTrigger className="w-64 h-9 text-sm" data-testid="lpp-categoria"><SelectValue placeholder="Tutte le categorie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le categorie</SelectItem>
              {categorie.map(c => <SelectItem key={c.key} value={c.key}>{c.icon} {c.label} ({c.n_listini})</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca per nome, codice, descrizione…" className="pl-8 h-9 text-sm" data-testid="lpp-search" />
          </div>
          <Select value={fascia || "all"} onValueChange={v => setFascia(v === "all" ? "" : v)}>
            <SelectTrigger className="w-36 h-9 text-sm" data-testid="lpp-fascia"><SelectValue placeholder="Tutte fasce" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte fasce</SelectItem>
              <SelectItem value="low">Base (≤€50)</SelectItem>
              <SelectItem value="medium">Media (€50–200)</SelectItem>
              <SelectItem value="high">Alta (&gt;€200)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto border border-zinc-200 rounded">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 sticky top-0"><tr>
              <th className="w-10 px-2 py-2"></th>
              <th className="px-2 py-2 text-left">Prodotto</th>
              <th className="px-2 py-2 text-left">Fornitore</th>
              <th className="px-2 py-2 text-right w-20">€/u</th>
              <th className="px-2 py-2 text-center w-16">Fascia</th>
              <th className="px-2 py-2 text-center w-24">Quantità</th>
            </tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && <tr><td colSpan={6} className="px-3 py-8 text-center text-zinc-500 text-xs">Ricerca…</td></tr>}
              {!loading && !results.length && <tr><td colSpan={6} className="px-3 py-12 text-center text-zinc-400 text-xs">{categoria ? "Nessun prodotto trovato. Carica un listino in questa categoria." : "Scegli una categoria o digita una parola chiave."}</td></tr>}
              {!loading && results.map(p => {
                const sel = !!selected[p.id];
                return (
                  <tr key={p.id} className={sel ? "bg-blue-50" : "hover:bg-zinc-50"}>
                    <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={sel} onChange={() => toggle(p)} className="h-4 w-4" data-testid={`lpp-sel-${p.id}`} /></td>
                    <td className="px-2 py-1.5">
                      <div className="font-medium text-xs">{p.nome}</div>
                      <div className="text-[10px] text-zinc-500">{p.codice ? `[${p.codice}] ` : ""}{p.categoria_dettaglio || "—"} · {p.unit}</div>
                    </td>
                    <td className="px-2 py-1.5 text-xs">
                      <div className="text-zinc-700">{p.fornitore_nome}</div>
                      <div className="text-[10px] text-zinc-500">{p.listino_nome}</div>
                    </td>
                    <td className="px-2 py-1.5 text-right mono font-semibold text-blue-700">€ {(p.prezzo_rivendita || 0).toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-center"><span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${FASCIA_BADGE[p.fascia_prezzo] || ""}`}>{FASCIA_LABEL[p.fascia_prezzo] || "—"}</span></td>
                    <td className="px-2 py-1.5">
                      {sel && <Input type="number" min={0.01} step="0.01" value={selected[p.id].qty} onChange={e => setQty(p.id, e.target.value)} className="h-7 text-xs text-right mono" data-testid={`lpp-qty-${p.id}`} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <DialogFooter className="border-t border-zinc-200 pt-3">
          <div className="flex items-center gap-3 mr-auto text-xs">
            <span className="text-zinc-500">{Object.keys(selected).length} selezionato/i</span>
            {Object.keys(selected).length > 0 && <span className="font-semibold mono text-blue-700" data-testid="lpp-total">€ {total.toFixed(2)}</span>}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={confirm} disabled={!Object.keys(selected).length} style={{ background: "var(--brand)", color: "white" }} data-testid="lpp-confirm"><Plus className="h-4 w-4 mr-1" /> Aggiungi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
