import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, Receipt, Trash2, MoreVertical, Search, Send, CheckCircle2, XCircle, FileText } from "lucide-react";
import { fmtEuro } from "../editor/utils";

const STATO_STYLES = {
  bozza: "bg-zinc-100 text-zinc-700 border-zinc-300",
  inviato: "bg-blue-50 text-blue-700 border-blue-300",
  accettato: "bg-green-50 text-green-700 border-green-300",
  rifiutato: "bg-red-50 text-red-700 border-red-300",
};

function computeTotals(p, packageObj) {
  if (!packageObj) return { base: 0, extras: 0, optional: 0, bagno: 0, subtotal: 0, iva: 0, total: 0 };
  const base = (packageObj.price_per_m2 || 0) * (p.mq || 0);
  const extras = (p.items || []).reduce((s, it) => {
    const extra = Math.max(0, (it.qty_richiesta || 0) - (it.included_qty || 0));
    return s + extra * (it.unit_price || 0);
  }, 0);
  const optional = (p.optional || []).reduce((s, o) => s + (o.total || 0), 0);
  const bagno = (p.bathroom_surcharge || 0);
  const subtotal = base + extras + optional + bagno;
  const afterDiscount = subtotal * (1 - (p.sconto_pct || 0) / 100);
  const iva = afterDiscount * (p.iva_pct || 10) / 100;
  const total = afterDiscount + iva;
  return { base, extras, optional, bagno, subtotal, iva, total };
}

export default function Preventivi() {
  const [items, setItems] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const nav = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const [pr, pk] = await Promise.all([api.get("/preventivi"), api.get("/packages")]);
      setItems(pr.data); setPackages(pk.data);
    } catch { toast.error("Errore caricamento preventivi"); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const del = async (id) => {
    if (!window.confirm("Eliminare questo preventivo?")) return;
    await api.delete(`/preventivi/${id}`); load(); toast.success("Eliminato");
  };
  const setStato = async (id, stato) => {
    await api.patch(`/preventivi/${id}/stato`, { stato }); load();
  };

  const filtered = items.filter((it) => {
    const s = q.toLowerCase();
    return !s || (it.numero || "").toLowerCase().includes(s)
      || (it.cliente?.nome || "").toLowerCase().includes(s)
      || (it.cliente?.cognome || "").toLowerCase().includes(s);
  });

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-10" data-testid="preventivi-page">
        <div className="flex items-end justify-between mb-8 border-b border-zinc-200 pb-6">
          <div>
            <div className="label-kicker mb-2">Vendita</div>
            <h1 className="text-4xl font-semibold tracking-tight" style={{ fontFamily: "Outfit" }}>Preventivi</h1>
            <p className="text-sm text-zinc-500 mt-2 mono">{items.length} totali · {items.filter(i => i.stato === "accettato").length} accettati</p>
          </div>
          <Link to="/preventivi/nuovo" data-testid="new-preventivo-button">
            <Button className="rounded-sm bg-zinc-900 hover:bg-zinc-800 h-11">
              <Plus size={16} className="mr-2" /> Nuovo preventivo
            </Button>
          </Link>
        </div>

        <div className="relative mb-6 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca per numero o cliente…" className="rounded-sm h-10 pl-9" data-testid="preventivi-search" />
        </div>

        {loading ? (
          <div className="mono text-sm text-zinc-500">caricamento…</div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-zinc-300 p-16 text-center" data-testid="empty-preventivi">
            <Receipt size={32} className="mx-auto text-zinc-400 mb-4" strokeWidth={1.5} />
            <div className="text-lg font-medium mb-1" style={{ fontFamily: "Outfit" }}>Nessun preventivo</div>
            <div className="text-sm text-zinc-500 mb-6 mono">Parti da uno dei 4 pacchetti e genera un preventivo in 2 minuti</div>
            <Link to="/preventivi/nuovo"><Button className="rounded-sm bg-zinc-900 hover:bg-zinc-800"><Plus size={16} className="mr-2" /> Nuovo preventivo</Button></Link>
          </div>
        ) : (
          <div className="border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50">
                <tr className="text-xs uppercase tracking-widest text-zinc-500">
                  <th className="text-left py-3 px-4 font-medium">Numero</th>
                  <th className="text-left py-3 px-4 font-medium">Cliente</th>
                  <th className="text-left py-3 px-4 font-medium">Pacchetto</th>
                  <th className="text-right py-3 px-4 font-medium">m²</th>
                  <th className="text-right py-3 px-4 font-medium">Totale (IVA incl.)</th>
                  <th className="text-left py-3 px-4 font-medium">Stato</th>
                  <th className="text-left py-3 px-4 font-medium">Data</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => {
                  const pkg = packages.find((p) => p.id === it.package_id);
                  const t = computeTotals(it, pkg);
                  return (
                    <tr key={it.id} className="border-t border-zinc-100 hover:bg-zinc-50 cursor-pointer"
                      onClick={() => nav(`/preventivi/${it.id}`)}
                      data-testid={`preventivo-row-${it.id}`}
                    >
                      <td className="py-3 px-4 mono font-medium">{it.numero}</td>
                      <td className="py-3 px-4">{(it.cliente?.nome || "") + " " + (it.cliente?.cognome || "")}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2 h-2" style={{ background: pkg?.color || "#A1A1AA" }} />
                          {pkg?.name || "—"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right mono">{it.mq}</td>
                      <td className="py-3 px-4 text-right mono font-medium">{fmtEuro(t.total)}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 text-xs uppercase tracking-widest border ${STATO_STYLES[it.stato] || STATO_STYLES.bozza}`}>
                          {it.stato}
                        </span>
                      </td>
                      <td className="py-3 px-4 mono text-xs text-zinc-500">
                        {new Date(it.created_at).toLocaleDateString("it-IT")}
                      </td>
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-7 h-7 hover:bg-zinc-100 flex items-center justify-center" data-testid={`preventivo-menu-${it.id}`}>
                              <MoreVertical size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-sm">
                            <DropdownMenuItem onClick={() => nav(`/preventivi/${it.id}`)}><FileText size={14} className="mr-2" /> Apri</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStato(it.id, "inviato")}><Send size={14} className="mr-2" /> Segna come inviato</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStato(it.id, "accettato")}><CheckCircle2 size={14} className="mr-2 text-green-600" /> Accettato</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStato(it.id, "rifiutato")}><XCircle size={14} className="mr-2 text-red-600" /> Rifiutato</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => del(it.id)} className="text-red-600"><Trash2 size={14} className="mr-2" /> Elimina</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
