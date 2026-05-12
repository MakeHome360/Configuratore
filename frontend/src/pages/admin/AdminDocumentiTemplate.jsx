import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Page, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Download, Trash2, FileUp, FileText } from "lucide-react";
import { toast } from "sonner";

const fmtSize = (n) => {
  if (!n) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

export default function AdminDocumentiTemplate() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [tipi, setTipi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", tipo: "altro", descrizione: "", file: null });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [tp, ls] = await Promise.all([
        api.get("/documenti-template/tipi"),
        api.get("/documenti-template"),
      ]);
      setTipi(tp.data || []);
      setItems(ls.data || []);
    } catch (e) {
      toast.error("Errore caricamento: " + (e?.response?.data?.detail || e.message));
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const upload = async () => {
    if (!form.file) return toast.error("Seleziona un file");
    if (!form.nome) return toast.error("Inserisci il nome del documento");
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", form.file);
      fd.append("nome", form.nome);
      fd.append("tipo", form.tipo);
      if (form.descrizione) fd.append("descrizione", form.descrizione);
      await api.post("/documenti-template", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Template caricato");
      setOpen(false);
      setForm({ nome: "", tipo: "altro", descrizione: "", file: null });
      load();
    } catch (e) {
      toast.error("Errore upload: " + (e?.response?.data?.detail || e.message));
    }
    setSaving(false);
  };

  const del = async (id) => {
    if (!window.confirm("Eliminare definitivamente questo template?")) return;
    try {
      await api.delete(`/documenti-template/${id}`);
      toast.success("Template eliminato");
      load();
    } catch (e) {
      toast.error("Errore: " + (e?.response?.data?.detail || e.message));
    }
  };

  const tipoLabel = (id) => (tipi.find(t => t.id === id) || {}).label || id;

  // Raggruppa per tipo
  const grouped = items.reduce((acc, it) => {
    const k = it.tipo || "altro";
    (acc[k] = acc[k] || []).push(it);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Documenti Aziendali — Template"
        subtitle={isAdmin
          ? "Carica qui i documenti VERGINI dell'azienda (contratti, capitolati, privacy, checklist). I venditori e i PM li scaricano per farli firmare a clienti/subappaltatori."
          : "Documenti vergini dell'azienda da scaricare e far firmare a clienti/subappaltatori. Solo l'amministratore può caricare nuovi template."}
        actions={isAdmin && (
          <Button onClick={() => setOpen(true)} data-testid="doc-tpl-add" style={{ background: "var(--brand)", color: "white" }}>
            <FileUp className="h-4 w-4 mr-2" /> Carica template
          </Button>
        )}
      />
      <Page>
        {loading ? (
          <div className="text-zinc-500">Caricamento…</div>
        ) : !items.length ? (
          <div className="bg-white border border-dashed border-zinc-300 rounded-lg p-12 text-center">
            <FileText className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
            <div className="text-zinc-700 font-semibold mb-1">Nessun template caricato</div>
            <div className="text-zinc-500 text-sm mb-4">{isAdmin ? "Inizia caricando i documenti vergini dell'azienda (contratti, capitolati, ecc)." : "L'amministratore non ha ancora caricato template aziendali."}</div>
            {isAdmin && (
              <Button onClick={() => setOpen(true)} data-testid="doc-tpl-add-empty">
                <FileUp className="h-4 w-4 mr-2" /> Carica primo template
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([tipo, list]) => (
              <div key={tipo} className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-200">
                  <h3 className="font-semibold text-sm uppercase tracking-wide">{tipoLabel(tipo)}</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase">
                    <tr className="border-b border-zinc-100">
                      <th className="text-left px-4 py-2">Nome documento</th>
                      <th className="text-left px-4 py-2">Descrizione</th>
                      <th className="text-left px-4 py-2 w-32">Caricato</th>
                      <th className="text-right px-4 py-2 w-24">Dim.</th>
                      <th className="text-right px-4 py-2 w-36">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {list.map((d) => (
                      <tr key={d.id} className="hover:bg-zinc-50" data-testid={`doc-tpl-row-${d.id}`}>
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{d.nome}</div>
                          <div className="text-xs text-zinc-500 mono">{d.filename_originale}</div>
                        </td>
                        <td className="px-4 py-2.5 text-zinc-600 text-xs">{d.descrizione || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-zinc-500">
                          {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString("it-IT") : "—"}
                          {d.uploaded_by_name && <div className="text-[10px]">{d.uploaded_by_name}</div>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-zinc-500 mono">{fmtSize(d.size)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <a href={d.url} target="_blank" rel="noopener noreferrer" download={d.filename_originale}>
                            <Button size="sm" variant="outline" data-testid={`doc-tpl-download-${d.id}`}>
                              <Download className="h-3.5 w-3.5 mr-1" /> Scarica
                            </Button>
                          </a>
                          {isAdmin && (
                            <Button size="sm" variant="outline" className="ml-1 text-rose-600 hover:bg-rose-50" onClick={() => del(d.id)} data-testid={`doc-tpl-del-${d.id}`}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </Page>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Carica nuovo template aziendale</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome documento *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Es: Contratto cliente 2026 v2" data-testid="doc-tpl-nome" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger data-testid="doc-tpl-tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tipi.map((t) => (<SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrizione (opzionale)</Label>
              <Textarea value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} placeholder="A cosa serve, quando usarlo, note importanti…" rows={3} />
            </div>
            <div>
              <Label>File (PDF / DOCX / max 20 MB) *</Label>
              <input
                type="file"
                onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
                className="block w-full text-sm mt-1.5 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-zinc-100 file:text-sm hover:file:bg-zinc-200"
                accept=".pdf,.doc,.docx,.odt,.txt,.png,.jpg,.jpeg"
                data-testid="doc-tpl-file"
              />
              {form.file && <div className="text-xs text-zinc-500 mt-1">{form.file.name} ({fmtSize(form.file.size)})</div>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={upload} disabled={saving} style={{ background: "var(--brand)", color: "white" }} data-testid="doc-tpl-upload-btn">
              {saving ? "Caricamento…" : "Carica template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
