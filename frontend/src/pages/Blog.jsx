import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowRight, Calendar } from "lucide-react";

export default function Blog() {
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/blog/posts", { params: { limit: 200 } }),
      api.get("/blog/categories"),
    ]).then(([p, c]) => {
      setPosts(p.data || []);
      setCategories(c.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = posts.filter(p => {
    if (filter && p.category !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (p.title || "").toLowerCase().includes(s)
        || (p.excerpt || "").toLowerCase().includes(s)
        || (p.tags || []).some(t => t.toLowerCase().includes(s));
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-zinc-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold tracking-tight" data-testid="blog-home-link">SadiCasa<span className="text-amber-400">.</span></Link>
          <nav className="flex gap-6 text-sm">
            <Link to="/" className="hover:text-amber-300">Home</Link>
            <Link to="/blog" className="text-amber-400">Blog</Link>
            <Link to="/login" className="hover:text-amber-300">Accedi</Link>
          </nav>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-5xl font-bold tracking-tight mb-3">Il blog di SadiCasa</h1>
          <p className="text-zinc-600 text-lg max-w-2xl">Guide pratiche, idee, costi reali e consigli da chi ristruttura case ogni giorno. Tutto quello che ti serve sapere per fare scelte intelligenti.</p>
        </div>

        {/* Filtri */}
        <div className="flex flex-col md:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca articoli (es. bagno, cucina, bonus)"
              className="pl-10 bg-white"
              data-testid="blog-search"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter("")}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${!filter ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 border border-zinc-200"}`}
              data-testid="blog-cat-all"
            >Tutte ({posts.length})</button>
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${filter === c ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50"}`}
                data-testid={`blog-cat-${c.toLowerCase().replace(/\s/g, '-')}`}
              >{c}</button>
            ))}
          </div>
        </div>

        {/* Lista articoli */}
        {loading ? (
          <div className="text-zinc-500 text-center py-20">Caricamento…</div>
        ) : !filtered.length ? (
          <div className="text-zinc-500 text-center py-20">Nessun articolo trovato.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(p => (
              <Link
                key={p.slug}
                to={`/blog/${p.slug}`}
                className="bg-white rounded-lg overflow-hidden border border-zinc-200 hover:border-zinc-400 hover:shadow-lg transition-all group"
                data-testid={`blog-card-${p.slug}`}
              >
                <div className="h-40 bg-gradient-to-br from-amber-100 via-stone-100 to-zinc-200 flex items-center justify-center text-7xl">
                  {p.hero_emoji || "📝"}
                </div>
                <div className="p-5">
                  <div className="text-[10px] uppercase tracking-widest text-amber-700 font-semibold mb-2">{p.category}</div>
                  <h3 className="font-bold text-lg leading-tight mb-2 group-hover:text-amber-700 transition-colors">{p.title}</h3>
                  <p className="text-sm text-zinc-600 line-clamp-3 mb-3">{p.excerpt}</p>
                  <div className="flex items-center justify-between text-xs text-zinc-400 pt-3 border-t border-zinc-100">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {p.published_at ? new Date(p.published_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }) : ""}</span>
                    <span className="text-amber-700 flex items-center gap-1 font-semibold group-hover:gap-2 transition-all">Leggi <ArrowRight className="h-3 w-3" /></span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* CTA finale */}
        <div className="mt-16 bg-zinc-900 text-white rounded-xl p-10 text-center">
          <h2 className="text-3xl font-bold mb-3">Pronto a iniziare la tua ristrutturazione?</h2>
          <p className="text-zinc-300 mb-6 max-w-xl mx-auto">Crea un preventivo dettagliato in 3 minuti con il nostro configuratore. Hai dimensioni reali, materiali certificati e bonus integrati.</p>
          <Link to="/login">
            <Button size="lg" style={{ background: "#FBBF24", color: "#0F0F0F" }} className="font-semibold" data-testid="blog-cta-preventivo">
              Crea il tuo preventivo →
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
