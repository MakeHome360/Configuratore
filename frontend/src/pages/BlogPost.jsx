import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, User, Tag } from "lucide-react";

// Mini markdown → HTML (titoli, bold, liste, paragrafi). No dipendenze esterne.
function mdToHtml(md) {
  if (!md) return "";
  // Escape HTML
  let html = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Titoli
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mt-8 mb-3 text-zinc-900">$1</h2>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold mt-6 mb-2 text-zinc-800">$1</h3>');
  // Bold + italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-zinc-900">$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Liste bullet
  html = html.replace(/^- (.+)$/gm, '<li class="ml-5 list-disc mb-1">$1</li>');
  // Liste numerate
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-5 list-decimal mb-1">$1</li>');
  // Wrap ul/ol consecutivi (best effort)
  html = html.replace(/((?:<li class="ml-5 list-disc[^>]*>[^<]+<\/li>\s*)+)/g, '<ul class="my-3">$1</ul>');
  html = html.replace(/((?:<li class="ml-5 list-decimal[^>]*>[^<]+<\/li>\s*)+)/g, '<ol class="my-3">$1</ol>');
  // Paragrafi (riga vuota separa)
  html = html.split(/\n\n+/).map(blk => {
    if (blk.match(/^<(h2|h3|ul|ol|li)/)) return blk;
    if (!blk.trim()) return "";
    return `<p class="mb-4 leading-relaxed text-zinc-700">${blk.trim()}</p>`;
  }).join("\n");
  return html;
}

export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setPost(null);
    api.get(`/blog/posts/${slug}`).then(r => {
      setPost(r.data);
      // SEO: aggiorna title e meta description
      if (r.data.title) document.title = `${r.data.title} | SadiCasa Blog`;
      if (r.data.meta_description) {
        let m = document.querySelector('meta[name="description"]');
        if (!m) { m = document.createElement("meta"); m.name = "description"; document.head.appendChild(m); }
        m.content = r.data.meta_description;
      }
      // Articoli correlati: stessa categoria
      api.get("/blog/posts", { params: { category: r.data.category, limit: 6 } }).then(rr => {
        setRelated((rr.data || []).filter(x => x.slug !== slug).slice(0, 3));
      });
    }).catch(() => setPost(null))
      .finally(() => setLoading(false));
    window.scrollTo(0, 0);
  }, [slug]);

  if (loading) {
    return <div className="min-h-screen bg-stone-50 flex items-center justify-center text-zinc-500">Caricamento articolo…</div>;
  }
  if (!post) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center gap-4">
        <div className="text-zinc-700 font-semibold">Articolo non trovato</div>
        <Link to="/blog"><Button variant="outline">← Torna al blog</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-zinc-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold tracking-tight">SadiCasa<span className="text-amber-400">.</span></Link>
          <nav className="flex gap-6 text-sm">
            <Link to="/" className="hover:text-amber-300">Home</Link>
            <Link to="/blog" className="text-amber-400">Blog</Link>
            <Link to="/login" className="hover:text-amber-300">Accedi</Link>
          </nav>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-10">
        <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 mb-6" data-testid="blog-back">
          <ArrowLeft className="h-4 w-4" /> Torna al blog
        </Link>

        {/* Hero */}
        <div className="h-56 bg-gradient-to-br from-amber-100 via-stone-100 to-zinc-200 rounded-xl flex items-center justify-center text-8xl mb-6">
          {post.hero_emoji || "📝"}
        </div>

        <div className="text-xs uppercase tracking-widest text-amber-700 font-bold mb-3">{post.category}</div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-zinc-900" data-testid="blog-title">{post.title}</h1>

        <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500 mb-8 pb-6 border-b border-zinc-200">
          <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {post.published_at ? new Date(post.published_at).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }) : ""}</span>
          <span className="flex items-center gap-1"><User className="h-4 w-4" /> {post.author || "Redazione"}</span>
          {(post.tags || []).slice(0, 3).map(t => (
            <span key={t} className="flex items-center gap-1 text-xs bg-zinc-100 px-2 py-0.5 rounded"><Tag className="h-3 w-3" /> {t}</span>
          ))}
        </div>

        <p className="text-xl text-zinc-700 leading-relaxed mb-8 italic">{post.excerpt}</p>

        {/* Content (markdown rendering) */}
        <div
          className="prose prose-zinc max-w-none"
          dangerouslySetInnerHTML={{ __html: mdToHtml(post.content_md) }}
          data-testid="blog-content"
        />

        {/* CTA */}
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6 my-12 text-center">
          <h3 className="text-2xl font-bold mb-2">Vuoi un preventivo personalizzato?</h3>
          <p className="text-zinc-600 mb-4">Crea in 3 minuti un preventivo dettagliato con il nostro configuratore CAD. Voci reali, materiali certificati, bonus integrati.</p>
          <Link to="/login">
            <Button size="lg" style={{ background: "#0F0F0F", color: "white" }} data-testid="blog-cta-preventivo-bottom">
              Inizia ora →
            </Button>
          </Link>
        </div>

        {/* Articoli correlati */}
        {related.length > 0 && (
          <div className="mt-12 pt-8 border-t border-zinc-200">
            <h3 className="text-xl font-bold mb-5">Articoli correlati</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {related.map(p => (
                <Link
                  key={p.slug}
                  to={`/blog/${p.slug}`}
                  className="bg-white rounded-lg border border-zinc-200 p-4 hover:border-zinc-400 transition-all"
                  data-testid={`blog-related-${p.slug}`}
                >
                  <div className="text-3xl mb-2">{p.hero_emoji || "📝"}</div>
                  <div className="text-[10px] uppercase tracking-widest text-amber-700 font-semibold mb-1">{p.category}</div>
                  <h4 className="font-semibold text-sm leading-tight">{p.title}</h4>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
