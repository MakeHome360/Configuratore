import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";
import { toast } from "sonner";

const ROLES = ["admin", "venditore", "cliente", "subappaltatore", "user"];

export default function AdminUtenti() {
  const [rows, setRows] = useState([]);
  const load = () => api.get("/users").then((r) => setRows(r.data || []));
  useEffect(() => { load(); }, []);
  const change = async (id, role) => { await api.put(`/users/${id}/role`, { role }); toast.success("Ruolo aggiornato"); load(); };

  return (
    <div>
      <PageHeader title="Utenti & Ruoli" subtitle="Gestisci gli accessi e i ruoli degli utenti" />
      <Page>
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="px-3 py-2 text-left">Nome</th><th className="px-3 py-2 text-left">Email</th><th className="px-3 py-2 text-left">Ruolo</th><th className="px-3 py-2 text-left">Creato</th></tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((u) => (
                <tr key={u.id}>
                  <td className="px-3 py-2 font-medium">{u.name}</td>
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2">
                    <select className="border border-zinc-300 rounded h-8 px-2 text-sm" value={u.role} onChange={(e) => change(u.id, e.target.value)} data-testid={`role-${u.id}`}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-500">{new Date(u.created_at).toLocaleDateString("it-IT")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Page>
    </div>
  );
}
