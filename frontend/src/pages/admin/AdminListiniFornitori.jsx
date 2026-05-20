import React, { useEffect, useState, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Edit3, Search, FileSpreadsheet, RefreshCw, ChevronLeft } from "lucide-react";

const FASCIA_BADGE = {
  low: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-rose-100 text-rose-800",
};
const FASCIA_LABEL = { low: "BASE", medium: "MEDIA", high: "ALTA" };

export default function AdminListiniFornitori() {
  const [categorie, setCategorie] = useState([]);
  const [listini, setListini] = useState([]);
  const [activeCat, setActiveCat] = useState("");
  const [openListino, setOpenListino] = useState(null); // listino aperto in dettaglio
  const [newDlg, setNewDlg] = useState(false);
  const [newForm, setNewForm] = useState({ fornitore_nome: "", categoria: "", nome: "", ricarico_default: 1.8, note: "" });

  const load = async () => {
    const cats = await api.get("/fornitori-listini-categorie").then(r => r.data || []);
    setCategorie(cats);
    const all = await api.get("/fornitori-listini").then(r => r.data || []);
    setListini(all);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => activeCat ? listini.filter(l => l.categoria === activeCat) : listini, [listini, activeCat]);

  const create = async () => {
    if (!newForm.fornitore_nome || !newForm.categoria || !newForm.nome) { toast.error("Compila fornitore, categoria, nome listino"); return; }
    try {
      const { data } = await api.post("/fornitori-listini", newForm);
      toast.success(`Listino "${data.nome}" creato`);
      setNewDlg(false);
      setNewForm({ fornitore_nome: "", categoria: "", nome: "", ricarico_default: 1.8, note: "" });
      await load();
      setOpenListino(data);
    } catch (e) { toast.error("Errore: " + (e?.response?.data?.detail || e.message)); }
  };

  const remove = async (lid) => {
    if (!window.confirm("Eliminare il listino? Anche tutti i prodotti contenuti verranno persi.")) return;
    try { await api.delete(`/fornitori-listini/${lid}`); toast.success("Listino eliminato"); load(); }
    catch (e) { toast.error("Errore: " + (e?.response?.data?.detail || e.message)); }
  };

  if (openListino) {
    return <ListinoDetail listino={openListino} onBack={() => { setOpenListino(null); load(); }} reload={load} />;
  }

  return (
    <div data-testid="admin-listini-fornitori-page">
      <PageHeader
        title="Listini Fornitori"
        subtitle="Catalogo prezzi NETTI dei fornitori (porte, infissi, piastrelle, sanitari, ecc.). Carica i listini via Excel/CSV o aggiungi manualmente. I prodotti diventano selezionabili nei pacchetti e nel preventivo composite, con ricarico configurabile."
      />
      <Page>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={activeCat || "all"} onValueChange={v => setActiveCat(v === "all" ? "" : v)}>
              <SelectTrigger className="w-72" data-testid="lf-filter-categoria"><SelectValue placeholder="Tutte le categorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le categorie ({listini.length})</SelectItem>
                {categorie.map(c => <SelectItem key={c.key} value={c.key}>{c.icon} {c.label} ({c.n_listini})</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={load} data-testid="lf-reload"><RefreshCw className="h-4 w-4 mr-1" /> Ricarica</Button>
          </div>
          <Button size="sm" onClick={() => setNewDlg(true)} style={{ background: "var(--brand)", color: "white" }} data-testid="lf-new">
            <Plus className="h-4 w-4 mr-1.5" /> Nuovo Listino
          </Button>
        </div>

        {/* Card categorie */}
        {!activeCat && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-5">
            {categorie.map(c => (
              <button key={c.key} onClick={() => setActiveCat(c.key)} className={`bg-white border rounded p-3 text-left hover:border-blue-400 transition ${c.n_listini > 0 ? "border-blue-200" : "border-zinc-200 opacity-70"}`} data-testid={`lf-cat-${c.key}`}>
                <div className="text-3xl mb-1">{c.icon}</div>
                <div className="font-medium text-sm">{c.label}</div>
                <div className="text-[10px] text-zinc-500 mt-1">{c.n_listini} listino/i</div>
              </button>
            ))}
          </div>
        )}

        {/* Lista listini */}
        <div className="bg-white border border-zinc-200 rounded">
          <div className="p-3 border-b border-zinc-200 text-xs uppercase text-zinc-500 flex items-center justify-between">
            <span>{filtered.length} listino/i {activeCat ? `· ${(categorie.find(c => c.key === activeCat) || {}).label}` : ""}</span>
            {activeCat && <button onClick={() => setActiveCat("")} className="text-blue-600 hover:underline normal-case"><ChevronLeft className="h-3 w-3 inline" /> Tutte le categorie</button>}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
              <th className="px-3 py-2 text-left">Fornitore</th>
              <th className="px-3 py-2 text-left">Listino</th>
              <th className="px-3 py-2 text-left">Categoria</th>
              <th className="px-3 py-2 text-right">Prodotti</th>
              <th className="px-3 py-2 text-right">Ricarico</th>
              <th className="px-3 py-2 text-left">Aggiornato</th>
              <th className="w-20"></th>
            </tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(l => (
                <tr key={l.id} className="hover:bg-zinc-50 cursor-pointer" onClick={() => setOpenListino(l)} data-testid={`lf-row-${l.id}`}>
                  <td className="px-3 py-2 font-medium">{l.fornitore_nome}</td>
                  <td className="px-3 py-2">{l.nome}</td>
                  <td className="px-3 py-2 text-xs">{(categorie.find(c => c.key === l.categoria) || {}).label || l.categoria}</td>
                  <td className="px-3 py-2 text-right mono">{l.n_prodotti}</td>
                  <td className="px-3 py-2 text-right mono">×{l.ricarico_default}</td>
                  <td className="px-3 py-2 text-xs text-zinc-500">{l.updated_at ? new Date(l.updated_at).toLocaleDateString("it-IT") : "-"}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={(e) => { e.stopPropagation(); remove(l.id); }} className="text-rose-600 hover:bg-rose-50 p-1.5 rounded" data-testid={`lf-del-${l.id}`}><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={7} className="px-3 py-12 text-center text-zinc-400">Nessun listino. Crea il primo con il bottone "Nuovo Listino".</td></tr>}
            </tbody>
          </table>
        </div>
      </Page>

      <Dialog open={newDlg} onOpenChange={setNewDlg}>
        <DialogContent className="max-w-md" data-testid="lf-new-dialog">
          <DialogHeader><DialogTitle>Nuovo Listino Fornitore</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Nome fornitore *</Label><Input value={newForm.fornitore_nome} onChange={e => setNewForm({ ...newForm, fornitore_nome: e.target.value })} placeholder="Es. Garofoli SpA, Marazzi, ecc." data-testid="lf-new-fornitore" /></div>
            <div><Label className="text-xs">Categoria *</Label>
              <Select value={newForm.categoria} onValueChange={v => setNewForm({ ...newForm, categoria: v })}>
                <SelectTrigger data-testid="lf-new-categoria"><SelectValue placeholder="Scegli categoria…" /></SelectTrigger>
                <SelectContent>
                  {categorie.map(c => <SelectItem key={c.key} value={c.key}>{c.icon} {c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Nome listino *</Label><Input value={newForm.nome} onChange={e => setNewForm({ ...newForm, nome: e.target.value })} placeholder="Es. Listino 2026 Q1" data-testid="lf-new-nome" /></div>
            <div><Label className="text-xs">Ricarico di default (moltiplicatore)</Label>
              <Input type="number" step="0.05" value={newForm.ricarico_default} onChange={e => setNewForm({ ...newForm, ricarico_default: parseFloat(e.target.value) || 1.8 })} data-testid="lf-new-ricarico" />
              <p className="text-[10px] text-zinc-500 mt-1">Es. 1.8 = +80% sul netto. Override possibile per singolo prodotto.</p>
            </div>
            <div><Label className="text-xs">Note</Label><Input value={newForm.note} onChange={e => setNewForm({ ...newForm, note: e.target.value })} placeholder="Riferimenti, scadenza listino, ecc." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDlg(false)}>Annulla</Button>
            <Button onClick={create} style={{ background: "var(--brand)", color: "white" }} data-testid="lf-new-submit">Crea listino</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ListinoDetail({ listino: initialListino, onBack, reload: reloadParent }) {
  const [listino, setListino] = useState(initialListino);
  const [q, setQ] = useState("");
  const [fasciaFilter, setFasciaFilter] = useState("");
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [importDlg, setImportDlg] = useState(false);
  const [importMode, setImportMode] = useState("append");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const reload = async () => {
    const { data } = await api.get(`/fornitori-listini/${listino.id}`);
    setListino(data);
  };

  const prodotti = Array.isArray(listino.prodotti) ? listino.prodotti : [];
  const filtered = useMemo(() => {
    return prodotti.filter(p => {
      if (!p) return false;
      if (fasciaFilter && p.fascia_prezzo !== fasciaFilter) return false;
      if (q) {
        const blob = `${p.nome || ""} ${p.codice || ""} ${p.descrizione || ""} ${p.categoria_dettaglio || ""}`.toLowerCase();
        if (!blob.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [prodotti, q, fasciaFilter]);

  const openEdit = (p) => {
    setEditing(p?.id || "_new_");
    setEditForm(p || { codice: "", nome: "", descrizione: "", unit: "pz", prezzo_netto: 0, ricarico: null, categoria_dettaglio: "", attivo: true });
  };
  const saveProd = async () => {
    if (!editForm.nome) { toast.error("Nome obbligatorio"); return; }
    try {
      if (editing === "_new_") {
        await api.post(`/fornitori-listini/${listino.id}/prodotti`, editForm);
      } else {
        await api.put(`/fornitori-listini/${listino.id}/prodotti/${editing}`, editForm);
      }
      toast.success("Prodotto salvato");
      setEditing(null);
      reload();
    } catch (e) { toast.error("Errore: " + (e?.response?.data?.detail || e.message)); }
  };
  const delProd = async (pid) => {
    if (!window.confirm("Eliminare il prodotto?")) return;
    try { await api.delete(`/fornitori-listini/${listino.id}/prodotti/${pid}`); reload(); }
    catch (e) { toast.error("Errore: " + e.message); }
  };
  const onFileImport = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", f);
      const { data } = await api.post(`/fornitori-listini/${listino.id}/import?mode=${importMode}`, form, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Importati ${data.imported} prodotti. Saltati ${data.skipped}.`);
      setImportDlg(false);
      reload();
    } catch (err) { toast.error("Errore import: " + (err?.response?.data?.detail || err.message)); }
    finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };
  const clearAll = async () => {
    if (!window.confirm(`Eliminare TUTTI i ${prodotti.length} prodotti del listino? L'azione è irreversibile.`)) return;
    try { await api.post(`/fornitori-listini/${listino.id}/clear`); reload(); }
    catch (e) { toast.error("Errore: " + e.message); }
  };

  return (
    <div data-testid="admin-listino-detail-page">
      <PageHeader
        title={`${listino.fornitore_nome} · ${listino.nome}`}
        subtitle={`Categoria: ${listino.categoria} · ${prodotti.length} prodotti · Ricarico default ×${Number(listino.ricarico_default || 1.8).toFixed(2)}`}
      />
      <Page>
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={onBack} data-testid="lf-back"><ChevronLeft className="h-4 w-4 mr-1" /> Tutti i listini</Button>
          <div className="flex items-center gap-2 flex-1 max-w-md ml-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca prodotto, codice…" className="pl-8 h-9 text-sm" data-testid="lf-search" />
            </div>
            <Select value={fasciaFilter || "all"} onValueChange={v => setFasciaFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="Tutte fasce" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le fasce</SelectItem>
                <SelectItem value="low">Base (≤€50)</SelectItem>
                <SelectItem value="medium">Media (€50–200)</SelectItem>
                <SelectItem value="high">Alta (&gt;€200)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            {prodotti.length > 0 && <Button size="sm" variant="outline" onClick={clearAll} className="text-rose-600 border-rose-300 hover:bg-rose-50" data-testid="lf-clear">Svuota</Button>}
            <Button size="sm" variant="outline" onClick={() => setImportDlg(true)} data-testid="lf-import-open"><FileSpreadsheet className="h-4 w-4 mr-1" /> Import Excel/CSV</Button>
            <Button size="sm" onClick={() => openEdit(null)} style={{ background: "var(--brand)", color: "white" }} data-testid="lf-add-prodotto"><Plus className="h-4 w-4 mr-1" /> Prodotto</Button>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
              <th className="px-3 py-2 text-left w-20">Codice</th>
              <th className="px-3 py-2 text-left">Nome prodotto</th>
              <th className="px-3 py-2 text-left w-32">Sotto-cat.</th>
              <th className="px-3 py-2 text-left w-16">U.M.</th>
              <th className="px-3 py-2 text-right w-24">Netto €</th>
              <th className="px-3 py-2 text-right w-20">Ricarico</th>
              <th className="px-3 py-2 text-right w-24">Rivendita €</th>
              <th className="px-3 py-2 text-center w-20">Fascia</th>
              <th className="px-3 py-2 text-center w-16">Attivo</th>
              <th className="w-16"></th>
            </tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(p => (
                <tr key={p.id} className={!p.attivo ? "opacity-50" : ""} data-testid={`lf-prod-${p.id}`}>
                  <td className="px-3 py-2 mono text-xs text-zinc-500">{p.codice || "—"}</td>
                  <td className="px-3 py-2"><div className="font-medium">{p.nome}</div>{p.descrizione && <div className="text-[11px] text-zinc-500">{p.descrizione}</div>}</td>
                  <td className="px-3 py-2 text-xs">{p.categoria_dettaglio || "—"}</td>
                  <td className="px-3 py-2 text-xs">{p.unit || "pz"}</td>
                  <td className="px-3 py-2 text-right mono">€ {Number(p.prezzo_netto || 0).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right mono text-xs">×{Number(p.ricarico || listino.ricarico_default || 1.8).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right mono font-semibold text-blue-700">€ {Number(p.prezzo_rivendita || (Number(p.prezzo_netto || 0) * Number(p.ricarico || listino.ricarico_default || 1.8))).toFixed(2)}</td>
                  <td className="px-3 py-2 text-center"><span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${FASCIA_BADGE[p.fascia_prezzo] || ""}`}>{FASCIA_LABEL[p.fascia_prezzo] || "—"}</span></td>
                  <td className="px-3 py-2 text-center">{p.attivo ? "✓" : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => openEdit(p)} className="text-blue-600 hover:bg-blue-50 p-1 rounded" data-testid={`lf-prod-edit-${p.id}`}><Edit3 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => delProd(p.id)} className="text-rose-600 hover:bg-rose-50 p-1 rounded" data-testid={`lf-prod-del-${p.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={10} className="px-3 py-12 text-center text-zinc-400">{prodotti.length ? "Nessun prodotto con questi filtri" : "Listino vuoto — aggiungi manualmente o importa Excel/CSV"}</td></tr>}
            </tbody>
          </table>
        </div>
      </Page>

      {/* Dialog Edit prodotto */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-lg" data-testid="lf-edit-dialog">
          <DialogHeader><DialogTitle>{editing === "_new_" ? "Nuovo Prodotto" : "Modifica Prodotto"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Codice articolo</Label><Input value={editForm.codice || ""} onChange={e => setEditForm({ ...editForm, codice: e.target.value })} data-testid="lf-edit-codice" /></div>
              <div><Label className="text-xs">U.M.</Label><Input value={editForm.unit || "pz"} onChange={e => setEditForm({ ...editForm, unit: e.target.value })} placeholder="pz, m², ml, kg…" data-testid="lf-edit-unit" /></div>
            </div>
            <div><Label className="text-xs">Nome prodotto *</Label><Input value={editForm.nome || ""} onChange={e => setEditForm({ ...editForm, nome: e.target.value })} data-testid="lf-edit-nome" /></div>
            <div><Label className="text-xs">Descrizione</Label><Input value={editForm.descrizione || ""} onChange={e => setEditForm({ ...editForm, descrizione: e.target.value })} data-testid="lf-edit-desc" /></div>
            <div><Label className="text-xs">Sotto-categoria</Label><Input value={editForm.categoria_dettaglio || ""} onChange={e => setEditForm({ ...editForm, categoria_dettaglio: e.target.value })} placeholder="Es. Scorrevole, Battente, Effetto legno…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Prezzo netto € *</Label><Input type="number" step="0.01" value={editForm.prezzo_netto || 0} onChange={e => setEditForm({ ...editForm, prezzo_netto: parseFloat(e.target.value) || 0 })} className="mono text-right" data-testid="lf-edit-netto" /></div>
              <div><Label className="text-xs">Ricarico (× moltiplicatore)</Label><Input type="number" step="0.05" value={editForm.ricarico ?? ""} onChange={e => setEditForm({ ...editForm, ricarico: e.target.value === "" ? null : parseFloat(e.target.value) || 0 })} placeholder={`Default ${listino.ricarico_default}`} className="mono text-right" data-testid="lf-edit-ricarico" /></div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-900">
              <strong>Prezzo rivendita calcolato:</strong> € {((editForm.prezzo_netto || 0) * (editForm.ricarico || listino.ricarico_default)).toFixed(2)}
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.attivo !== false} onChange={e => setEditForm({ ...editForm, attivo: e.target.checked })} /> Attivo (visibile in preventivi/pacchetti)</label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annulla</Button>
            <Button onClick={saveProd} style={{ background: "var(--brand)", color: "white" }} data-testid="lf-edit-submit">Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Import Excel/CSV */}
      <Dialog open={importDlg} onOpenChange={setImportDlg}>
        <DialogContent className="max-w-lg" data-testid="lf-import-dialog">
          <DialogHeader><DialogTitle>Importa listino da Excel/CSV</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs">
              <p className="font-semibold mb-1 text-amber-900">Formato richiesto (prima riga = intestazione)</p>
              <p className="text-amber-800">Colonne attese (nomi case-insensitive):</p>
              <ul className="text-amber-800 mt-1 space-y-0.5 ml-3">
                <li>• <code className="bg-white px-1 rounded">codice</code> (opzionale)</li>
                <li>• <code className="bg-white px-1 rounded">nome</code> ⚠ obbligatoria</li>
                <li>• <code className="bg-white px-1 rounded">descrizione</code></li>
                <li>• <code className="bg-white px-1 rounded">unit</code> (pz, m², ml…)</li>
                <li>• <code className="bg-white px-1 rounded">prezzo_netto</code> ⚠ numerico</li>
                <li>• <code className="bg-white px-1 rounded">categoria</code> (sotto-cat dettaglio)</li>
              </ul>
              <p className="text-amber-700 mt-2 text-[11px]">Il prezzo può contenere €, virgole o punti — vengono normalizzati. Il ricarico viene applicato dal default del listino (×{listino.ricarico_default}).</p>
            </div>
            <div>
              <Label className="text-xs">Modalità import</Label>
              <Select value={importMode} onValueChange={setImportMode}>
                <SelectTrigger data-testid="lf-import-mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="append">Aggiungi ai prodotti esistenti</SelectItem>
                  <SelectItem value="replace">Sostituisci tutti i prodotti</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">File (.xlsx, .xls, .csv)</Label>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileImport} disabled={importing} className="block w-full text-sm border border-zinc-300 rounded p-2" data-testid="lf-import-file" />
            </div>
            {importing && <div className="text-xs text-blue-600">Caricamento in corso…</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDlg(false)}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
