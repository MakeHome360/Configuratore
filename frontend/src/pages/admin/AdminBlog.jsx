import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const CATS = ["Ristrutturazione", "Bagno", "Cucina", "Costi e Preventivi", "Bonus e Detrazioni", "Materiali", "Risparmio Energetico", "Design", "Errori da evitare", "Guide pratiche", "Progettazione", "Esterni", "Investimenti immobiliari", "Accessibilità", "Burocrazia", "Tecnologia casa", "Ristrutturazione low-cost", "Mini appartamenti"];

const slugify = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

export default function AdminBlog() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | post obj
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/admin/blog/posts").then(r => setPosts(r.data || []))
      .catch(e => toast.error("Errore: " + (e?.response?.data?.detail || e.message)))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => setEditing({
    slug: "", title: "", category: "Guide pratiche", excerpt: "", content_md: "",
    tags: [], seo_keywords: "", meta_description: "", hero_emoji: "📝", published: false,
  });

  const save = async () => {
    if (!editing.title) return toast.error("Titolo obbligatorio");
    setSaving(true);
    try {
      const payload = { ...editing };
      if (Array.isArray(payload.tags_csv)) delete payload.tags_csv;
      if (typeof payload.tags === "string") payload.tags = payload.tags.split(",").map(t => t.trim()).filter(Boolean);
      if (!payload.slug) payload.slug = slugify(payload.title);
      if (editing._isNew) {
        await api.post("/admin/blog/posts", payload);
        toast.success("Articolo creato");
      } else {
        await api.put(`/admin/blog/posts/${editing.slug}`, payload);
        toast.success("Articolo aggiornato");
      }
      setEditing(null);
      load();
    } catch (e) {
      toast.error("Errore: " + (e?.response?.data?.detail || e.message));
    }
    setSaving(false);
  };

  const togglePublish = async (p) => {
    try {
      await api.put(`/admin/blog/posts/${p.slug}`, { published: !p.published });
      toast.success(p.published ? "Bozza" : "Pubblicato");
      load();
    } catch (e) { toast.error("Errore: " + (e?.response?.data?.detail || e.message)); }
  };

  const del = async (slug) => {
    if (!window.confirm(`Eliminare l'articolo "${slug}"?`)) return;
    try {
      await api.delete(`/admin/blog/posts/${slug}`);
      toast.success("Articolo eliminato");
      load();
    } catch (e) { toast.error("Errore: " + (e?.response?.data?.detail || e.message)); }
  };

  return (
    <div>
      <PageHeader
        title="Blog — Gestione articoli"
        subtitle={`${posts.length} articoli · ${posts.filter(p => p.published).length} pubblicati · ${posts.filter(p => !p.published).length} bozze`}
        actions={
          <div className="flex gap-2">
            <a href="/blog" target="_blank" rel="noopener noreferrer"><Button variant="outline" data-testid="blog-admin-view-public"><ExternalLink className="h-4 w-4 mr-2" /> Vedi blog pubblico</Button></a>
            <Button onClick={() => setEditing({ _isNew: true, slug: "", title: "", category: "Guide pratiche", excerpt: "", content_md: "", tags: "", seo_keywords: "", meta_description: "", hero_emoji: "📝", published: false })} style={{ background: "var(--brand)", color: "white" }} data-testid="blog-admin-new">
              <Plus className="h-4 w-4 mr-2" /> Nuovo articolo
            </Button>
          </div>
        }
      />
      <Page>
        {loading ? <div className="text-zinc-500">Caricamento…</div> : (
          <div className="bg-white border border-zinc-200 rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="text-left px-4 py-2">Titolo</th>
                  <th className="text-left px-4 py-2 w-40">Categoria</th>
                  <th className="text-center px-4 py-2 w-20">Stato</th>
                  <th className="text-center px-4 py-2 w-20">Views</th>
                  <th className="text-center px-4 py-2 w-32">Pubblicato</th>
                  <th className="text-right px-4 py-2 w-32">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {posts.map(p => (
                  <tr key={p.slug} className="hover:bg-zinc-50" data-testid={`blog-row-${p.slug}`}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{p.hero_emoji} {p.title}</div>
                      <div className="text-xs text-zinc-500 mono">/{p.slug}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{p.category}</td>
                    <td className="px-4 py-2.5 text-center">
                      {p.published ? <span className="text-emerald-700 text-xs font-semibold">● PUB</span> : <span className="text-amber-700 text-xs font-semibold">○ DRAFT</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs mono">{p.views || 0}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-zinc-500">{p.published_at ? new Date(p.published_at).toLocaleDateString("it-IT") : "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Button size="sm" variant="outline" onClick={() => togglePublish(p)} title={p.published ? "Metti in bozza" : "Pubblica"} data-testid={`blog-toggle-${p.slug}`}>
                        {p.published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="sm" variant="outline" className="ml-1" onClick={() => setEditing({ ...p, tags: (p.tags || []).join(", ") })} data-testid={`blog-edit-${p.slug}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="ml-1 text-rose-600" onClick={() => del(p.slug)} data-testid={`blog-del-${p.slug}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!posts.length && <tr><td colSpan={6} className="text-center py-12 text-zinc-500">Nessun articolo. Clicca "Nuovo articolo" per iniziare.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Page>

      {editing && (
        <Dialog open={true} onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing._isNew ? "Nuovo articolo" : `Modifica · ${editing.title}`}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Titolo *</Label>
                <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value, slug: editing._isNew && !editing.slug ? slugify(e.target.value) : editing.slug })} data-testid="blog-edit-title" />
              </div>
              {editing._isNew && (
                <div>
                  <Label className="text-xs">Slug URL (auto-generato dal titolo)</Label>
                  <Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })} className="font-mono text-xs" data-testid="blog-edit-slug" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Categoria</Label>
                  <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Hero emoji</Label>
                  <Input value={editing.hero_emoji} onChange={(e) => setEditing({ ...editing, hero_emoji: e.target.value })} placeholder="📝" />
                </div>
              </div>
              <div>
                <Label>Excerpt (riassunto breve, max 300 caratteri)</Label>
                <Textarea value={editing.excerpt} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} rows={2} maxLength={300} />
                <div className="text-[10px] text-zinc-500 mt-1">{(editing.excerpt || "").length}/300</div>
              </div>
              <div>
                <Label>Contenuto (Markdown)</Label>
                <Textarea
                  value={editing.content_md}
                  onChange={(e) => setEditing({ ...editing, content_md: e.target.value })}
                  rows={15}
                  className="font-mono text-xs"
                  placeholder="## Titolo sezione&#10;&#10;Testo del paragrafo...&#10;&#10;- Punto 1&#10;- Punto 2&#10;&#10;**grassetto** _corsivo_"
                  data-testid="blog-edit-content"
                />
                <div className="text-[10px] text-zinc-500 mt-1">{(editing.content_md || "").length} caratteri · ~{Math.round((editing.content_md || "").split(/\s+/).length)} parole</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tag (separati da virgola)</Label>
                  <Input value={typeof editing.tags === "string" ? editing.tags : (editing.tags || []).join(", ")} onChange={(e) => setEditing({ ...editing, tags: e.target.value })} placeholder="bagno, costi, guida" />
                </div>
                <div>
                  <Label>SEO Keywords</Label>
                  <Input value={editing.seo_keywords || ""} onChange={(e) => setEditing({ ...editing, seo_keywords: e.target.value })} placeholder="quanto costa bagno, prezzo bagno" />
                </div>
              </div>
              <div>
                <Label>Meta description (per Google, max 160 char)</Label>
                <Textarea value={editing.meta_description || ""} onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })} rows={2} maxLength={160} />
                <div className="text-[10px] text-zinc-500 mt-1">{(editing.meta_description || "").length}/160</div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-zinc-200">
                <Label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={!!editing.published} onCheckedChange={(v) => setEditing({ ...editing, published: v })} data-testid="blog-edit-published" />
                  <span className="text-sm">{editing.published ? "✅ Pubblicato (visibile pubblicamente)" : "📝 Bozza (nascosto al pubblico)"}</span>
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Annulla</Button>
              <Button onClick={save} disabled={saving} style={{ background: "var(--brand)", color: "white" }} data-testid="blog-edit-save">
                {saving ? "Salvataggio…" : "Salva"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
