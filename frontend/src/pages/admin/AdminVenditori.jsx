import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";

export default function AdminVenditori() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/venditori").then((r) => setRows(r.data || [])); }, []);
  return (
    <div>
      <PageHeader title="Gestione Venditori" subtitle="Performance, assegnazioni e statistiche per venditore" />
      <Page>
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="px-3 py-2 text-left">Nome</th><th className="px-3 py-2 text-left">Email</th><th className="px-3 py-2 text-right">Preventivi</th><th className="px-3 py-2 text-right">Commesse</th></tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((v) => (<tr key={v.id}><td className="px-3 py-2 font-medium">{v.name}</td><td className="px-3 py-2">{v.email}</td><td className="px-3 py-2 text-right">{v.preventivi}</td><td className="px-3 py-2 text-right">{v.commesse}</td></tr>))}
              {!rows.length && <tr><td colSpan={4} className="px-3 py-12 text-center text-zinc-500">Nessun venditore. Vai su "Utenti & Ruoli" per creare un utente con ruolo Venditore.</td></tr>}
            </tbody>
          </table>
        </div>
      </Page>
    </div>
  );
}
