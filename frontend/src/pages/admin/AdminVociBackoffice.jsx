import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader, StatCard, fmtEur, fmtEur2 } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Save, Trash2 } from "lucide-react";

const CATS = ["MURATURA", "IMPIANTI", "INFISSI", "SERVIZI"];

export default function AdminVociBackoffice() {
  const [rows, setRows] = useState([]);
  const [cat, setCat] = useState("MURATURA");
  const [dirty, setDirty] = useState({});

  const load = () => api.get("/voci-backoffice").then((r) => setRows(r.data || []));
  useEffect(() => { load(); }, []);

  const byCat = (c) => rows.filter((v) => v.category === c);
  const filt = byCat(cat);

  const saveRow = async (id) => {
    const row = rows.find((r) => r.id === id);
    await api.put(`/voci-backoffice/${id}`, { prezzo_acquisto: row.prezzo_acquisto, ricarico: row.ricarico, name: row.name, unit: row.unit });
    toast.success("Salvato"); setDirty((d) => ({ ...d, [id]: false })); load();
  };
  const upd = (id, k, v) => { setRows(rows.map((r) => r.id === id ? { ...r, [k]: v } : r)); setDirty((d) => ({ ...d, [id]: true })); };

  return (
    <div>
      <PageHeader title="Voci Backoffice" subtitle="Gestisci costi di acquisto e ricarichi per calcolare i margini" />
      <Page>
        <div className="grid grid-cols-4 gap-3 mb-5">
          {CATS.map((c) => {
            const vs = byCat(c);
            const acq = vs.reduce((s, v) => s + v.prezzo_acquisto, 0);
            const riv = vs.reduce((s, v) => s + v.prezzo_rivendita, 0);
            const mar = riv ? ((riv - acq) / riv * 100) : 0;
            return (
              <button key={c} onClick={() => setCat(c)} data-testid={`adm-vb-tab-${c}`}
                className={`p-4 border-2 rounded-lg text-left ${cat === c ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`}>
                <div className="font-bold">{c}</div>
                <div className="text-xs text-zinc-500 mt-1">Acquisto: {fmtEur2(acq)}</div>
                <div className="text-xs text-zinc-500">Rivendita: {fmtEur2(riv)}</div>
                <div className="text-xs font-semibold text-emerald-600">+{mar.toFixed(1)}%</div>
              </button>
            );
          })}
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr><th className="px-3 py-2 text-left">Voce</th><th className="px-3 py-2 text-right">Acquisto</th><th className="px-3 py-2 text-right">Ricarico</th><th className="px-3 py-2 text-right">Rivendita</th><th className="px-3 py-2 text-right">Margine</th><th></th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filt.map((v) => {
                const riv = v.prezzo_acquisto * v.ricarico;
                const marEur = riv - v.prezzo_acquisto;
                const marPct = riv ? (marEur / riv * 100) : 0;
                return (
                  <tr key={v.id}>
                    <td className="px-3 py-2">{v.name}</td>
                    <td className="px-3 py-2"><Input type="number" step="0.01" className="text-right h-8 w-24 ml-auto" value={v.prezzo_acquisto} onChange={(e) => upd(v.id, "prezzo_acquisto", Number(e.target.value))} data-testid={`vb-acq-${v.id}`} /></td>
                    <td className="px-3 py-2"><Input type="number" step="0.1" className="text-right h-8 w-20 ml-auto" value={v.ricarico} onChange={(e) => upd(v.id, "ricarico", Number(e.target.value))} /></td>
                    <td className="px-3 py-2 text-right font-mono">{fmtEur2(riv)}</td>
                    <td className={`px-3 py-2 text-right font-mono ${marPct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>+{marPct.toFixed(0)}%</td>
                    <td className="px-3 py-2">{dirty[v.id] && <Button size="sm" onClick={() => saveRow(v.id)}><Save className="h-3 w-3" /></Button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Page>
    </div>
  );
}
