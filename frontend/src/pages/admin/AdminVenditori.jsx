import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, BarChart3 } from "lucide-react";
import { toast } from "sonner";

export default function AdminVenditori() {
  const [rows, setRows] = useState([]);
  const [negozi, setNegozi] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", negozio_id: "", role: "venditore" });
  const nav = useNavigate();

  const reload = () => {
    api.get("/venditori").then((r) => setRows(r.data || [])).catch(() => {});
    api.get("/negozi").then((r) => setNegozi(r.data || [])).catch(() => {});
  };
  useEffect(() => { reload(); }, []);

  const submit = async () => {
    if (!form.name || !form.email || !form.password) { toast.error("Compila Nome, Email e Password"); return; }
    if (form.password.length < 8) { toast.error("Password almeno 8 caratteri"); return; }
    try {
      // 1) Crea utente
      const reg = await api.post("/auth/register", { name: form.name, email: form.email, password: form.password });
      const uid = reg.data?.id;
      if (!uid) throw new Error("Errore registrazione");
      // 2) Imposta ruolo
      await api.put(`/users/${uid}/role`, { role: form.role });
      // 3) Assegna negozio
      if (form.negozio_id) {
        await api.put(`/users/${uid}`, { negozio_id: form.negozio_id });
      }
      toast.success(`${form.role === "gestore" ? "Gestore" : "Venditore"} creato. Comunica le credenziali: ${form.email} / ${form.password}`);
      setOpen(false);
      setForm({ name: "", email: "", password: "", negozio_id: "", role: "venditore" });
      reload();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Errore creazione");
    }
  };

  const genPwd = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  };

  return (
    <div>
      <PageHeader title="Gestione Venditori" subtitle="Performance, assegnazioni e statistiche per venditore"
        actions={
          <Button onClick={() => { setForm({ name: "", email: "", password: genPwd(), negozio_id: "", role: "venditore" }); setOpen(true); }}
            className="rounded-sm bg-zinc-900 hover:bg-zinc-800 text-white" data-testid="invita-venditore-btn">
            <UserPlus className="h-4 w-4 mr-2" /> Crea/Invita venditore
          </Button>
        } />
      <Page>
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm" data-testid="venditori-table">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Negozio</th>
              <th className="px-3 py-2 text-left">Ruolo</th>
              <th className="px-3 py-2 text-left">Livello</th>
              <th className="px-3 py-2 text-right">Preventivi</th>
              <th className="px-3 py-2 text-right">Commesse</th>
              <th className="px-3 py-2 text-center">Azioni</th>
            </tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((v) => (
                <tr key={v.id}>
                  <td className="px-3 py-2 font-medium">{v.name}</td>
                  <td className="px-3 py-2 mono text-xs">{v.email}</td>
                  <td className="px-3 py-2 text-xs">{negozi.find(n => n.id === v.negozio_id)?.nome || "-"}</td>
                  <td className="px-3 py-2 text-xs uppercase">{v.role}</td>
                  <td className="px-3 py-2 text-xs uppercase">{v.venditore_level || "semplice"}</td>
                  <td className="px-3 py-2 text-right mono">{v.preventivi || 0}</td>
                  <td className="px-3 py-2 text-right mono">{v.commesse || 0}</td>
                  <td className="px-3 py-2 text-center">
                    <Button size="sm" variant="outline" className="rounded-sm h-8" onClick={() => nav(`/dashboardvenditore/${v.id}`)} data-testid={`btn-vend-dashboard-${v.id}`}>
                      <BarChart3 className="h-3.5 w-3.5 mr-1" /> Dashboard
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={8} className="px-3 py-12 text-center text-zinc-500">Nessun venditore. Clicca "Crea/Invita venditore" qui sopra per crearne uno.</td></tr>}
            </tbody>
          </table>
        </div>
      </Page>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Crea Venditore / Gestore</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-widest">Ruolo</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="rounded-sm h-9 mt-1" data-testid="invite-role-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="venditore">Venditore</SelectItem>
                  <SelectItem value="gestore">Gestore Cantieri</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest">Nome completo</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-sm h-9 mt-1" data-testid="invite-name" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest">Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="rounded-sm h-9 mt-1" data-testid="invite-email" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest">Password iniziale</Label>
              <div className="flex gap-2 mt-1">
                <Input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="rounded-sm h-9 mono" data-testid="invite-password" />
                <Button type="button" variant="outline" size="sm" className="rounded-sm h-9" onClick={() => setForm({ ...form, password: genPwd() })}>Genera</Button>
              </div>
            </div>
            {form.role === "venditore" && negozi.length > 0 && (
              <div>
                <Label className="text-xs uppercase tracking-widest">Negozio (per filtri CRM)</Label>
                <Select value={form.negozio_id} onValueChange={(v) => setForm({ ...form, negozio_id: v })}>
                  <SelectTrigger className="rounded-sm h-9 mt-1" data-testid="invite-negozio"><SelectValue placeholder="(opzionale)" /></SelectTrigger>
                  <SelectContent>
                    {negozi.map(n => <SelectItem key={n.id} value={n.id}>{n.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-sm">Annulla</Button>
            <Button onClick={submit} className="rounded-sm bg-zinc-900 text-white" data-testid="invite-submit">Crea utente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
