import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, BarChart3, Copy, CheckCircle2, ExternalLink, Settings2 } from "lucide-react";
import { toast } from "sonner";

const VENDITORE_LEVELS = [
  { value: "semplice", label: "Venditore semplice", desc: "Crea preventivi e gestisce i propri clienti. Vede solo i suoi numeri. Sconti max 5% auto." },
  { value: "responsabile", label: "Responsabile Punto Vendita", desc: "Coordina i venditori del suo punto vendita. Vede tutti i preventivi del PV. Può approvare sconti fino al 10%. Può creare voci nel Listino Opere." },
  { value: "area_manager", label: "Area Manager (più PV)", desc: "Gestisce più punti vendita. Accede ai numeri aggregati. Provvigione override sui venditori. Crea voci nel Listino Opere." },
];

const ROLES = [
  { value: "venditore", label: "Venditore / Responsabile / Area Manager", desc: "Crea preventivi, gestisce clienti e commesse." },
  { value: "gestore", label: "Gestore Cantieri", desc: "Project Manager. Valida SAL, gestisce documenti e subappaltatori." },
];

export default function AdminVenditori() {
  const [rows, setRows] = useState([]);
  const [negozi, setNegozi] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    role: "venditore", venditore_level: "semplice",
    negozio_id: "", negozi_ids: [],
    expires_at: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [lastInvite, setLastInvite] = useState(null);
  const nav = useNavigate();

  const reload = () => {
    api.get("/venditori").then((r) => setRows(r.data || [])).catch(() => {});
    api.get("/negozi").then((r) => setNegozi(r.data || [])).catch(() => {});
  };
  useEffect(() => { reload(); }, []);

  const resetForm = () => setForm({
    name: "", email: "", phone: "",
    role: "venditore", venditore_level: "semplice",
    negozio_id: "", negozi_ids: [], expires_at: "",
  });

  const toggleNeg = (id) => setForm((f) => ({
    ...f, negozi_ids: f.negozi_ids.includes(id) ? f.negozi_ids.filter((x) => x !== id) : [...f.negozi_ids, id],
  }));

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim()) { toast.error("Compila Nome ed Email"); return; }
    setSubmitting(true);
    try {
      const body = { name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone || "", role: form.role };
      if (form.expires_at) body.expires_at = new Date(form.expires_at + "T00:00:00").toISOString();
      if (form.role === "venditore") {
        body.venditore_level = form.venditore_level;
        if (form.venditore_level === "semplice" && form.negozio_id) body.negozio_id = form.negozio_id;
        if ((form.venditore_level === "responsabile" || form.venditore_level === "area_manager") && form.negozi_ids.length) body.negozi_ids = form.negozi_ids;
      }
      const { data } = await api.post("/users/invite", body);
      toast.success(`Utente creato. Password temporanea generata: ${data.temporary_password}`);
      setOpen(false);
      setLastInvite(data);
      resetForm();
      reload();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Errore creazione utente");
    } finally {
      setSubmitting(false);
    }
  };

  const niceLevel = (lvl) => VENDITORE_LEVELS.find((l) => l.value === lvl)?.label || (lvl || "semplice");
  const niceRole = (r) => r === "gestore" ? "Gestore Cantieri" : "Venditore";

  const selectedLevel = VENDITORE_LEVELS.find((l) => l.value === form.venditore_level);
  const selectedRole = ROLES.find((r) => r.value === form.role);

  return (
    <div>
      <PageHeader
        title="Gestione Venditori"
        subtitle="Performance, assegnazioni e statistiche per venditore"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => nav("/adminutenti")} className="rounded-sm" data-testid="admin-utenti-link">
              <Settings2 className="h-4 w-4 mr-2" /> Gestione utenti completa
            </Button>
            <Button onClick={() => { resetForm(); setOpen(true); }} className="rounded-sm bg-zinc-900 hover:bg-zinc-800 text-white" data-testid="invita-venditore-btn">
              <UserPlus className="h-4 w-4 mr-2" /> Crea/Invita venditore
            </Button>
          </div>
        }
      />
      <Page>
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm" data-testid="venditori-table">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left">Nome</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Negozio</th>
                <th className="px-3 py-2 text-left">Ruolo</th>
                <th className="px-3 py-2 text-left">Livello</th>
                <th className="px-3 py-2 text-right">Preventivi</th>
                <th className="px-3 py-2 text-right">Commesse</th>
                <th className="px-3 py-2 text-center">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((v) => (
                <tr key={v.id}>
                  <td className="px-3 py-2 font-medium">{v.name}</td>
                  <td className="px-3 py-2 mono text-xs">{v.email}</td>
                  <td className="px-3 py-2 text-xs">{negozi.find((n) => n.id === v.negozio_id)?.nome || (v.negozi_ids?.length ? `${v.negozi_ids.length} PV` : "-")}</td>
                  <td className="px-3 py-2 text-xs uppercase">{niceRole(v.role)}</td>
                  <td className="px-3 py-2 text-xs">{v.role === "venditore" ? niceLevel(v.venditore_level) : "—"}</td>
                  <td className="px-3 py-2 text-right mono">{v.preventivi || 0}</td>
                  <td className="px-3 py-2 text-right mono">{v.commesse || 0}</td>
                  <td className="px-3 py-2 text-center">
                    <Button size="sm" variant="outline" className="rounded-sm h-8" onClick={() => nav(`/dashboardvenditore/${v.id}`)} data-testid={`btn-vend-dashboard-${v.id}`}>
                      <BarChart3 className="h-3.5 w-3.5 mr-1" /> Dashboard
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={8} className="px-3 py-12 text-center text-zinc-500">Nessun venditore. Clicca "Crea/Invita venditore" qui sopra per crearne uno.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500 mt-3">
          Per modificare il livello, il negozio assegnato, la scadenza accesso o per gestire utenti pending (cliente/subappaltatore/admin), apri{" "}
          <button onClick={() => nav("/adminutenti")} className="underline text-zinc-700 hover:text-zinc-900">Gestione utenti completa <ExternalLink className="inline h-3 w-3" /></button>.
        </p>
      </Page>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg" data-testid="invita-venditore-dialog">
          <DialogHeader>
            <DialogTitle>Crea Venditore / Gestore Cantieri</DialogTitle>
            <DialogDescription>Genera l'account con password temporanea. La password verrà mostrata UNA volta: conservala o consegnala al collega.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label className="text-xs uppercase tracking-widest">Ruolo</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="rounded-sm h-9 mt-1" data-testid="invite-role-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {selectedRole && <div className="text-[11px] text-zinc-500 mt-1">{selectedRole.desc}</div>}
            </div>

            {form.role === "venditore" && (
              <div>
                <Label className="text-xs uppercase tracking-widest">Livello venditore</Label>
                <Select value={form.venditore_level} onValueChange={(v) => setForm({ ...form, venditore_level: v, negozio_id: "", negozi_ids: [] })}>
                  <SelectTrigger className="rounded-sm h-9 mt-1" data-testid="invite-level-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VENDITORE_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {selectedLevel && (
                  <div className="text-[11px] text-zinc-600 bg-emerald-50 border border-emerald-200 rounded p-2 mt-1.5 leading-snug" data-testid="invite-level-desc">
                    {selectedLevel.desc}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-widest">Nome completo *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-sm h-9 mt-1" data-testid="invite-name" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest">Telefono</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-sm h-9 mt-1" data-testid="invite-phone" />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest">Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-sm h-9 mt-1" data-testid="invite-email" />
            </div>

            {form.role === "venditore" && form.venditore_level === "semplice" && negozi.length > 0 && (
              <div>
                <Label className="text-xs uppercase tracking-widest">Negozio assegnato</Label>
                <Select value={form.negozio_id} onValueChange={(v) => setForm({ ...form, negozio_id: v })}>
                  <SelectTrigger className="rounded-sm h-9 mt-1" data-testid="invite-negozio"><SelectValue placeholder="(opzionale)" /></SelectTrigger>
                  <SelectContent>
                    {negozi.map((n) => <SelectItem key={n.id} value={n.id}>{n.nome || n.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.role === "venditore" && (form.venditore_level === "responsabile" || form.venditore_level === "area_manager") && negozi.length > 0 && (
              <div>
                <Label className="text-xs uppercase tracking-widest">Negozi gestiti</Label>
                <div className="mt-1 max-h-36 overflow-y-auto border border-zinc-200 rounded p-2 space-y-1" data-testid="invite-negozi-multi">
                  {negozi.map((n) => (
                    <label key={n.id} className="flex items-center gap-2 text-sm cursor-pointer p-1 hover:bg-zinc-50 rounded">
                      <input type="checkbox" checked={form.negozi_ids.includes(n.id)} onChange={() => toggleNeg(n.id)} className="accent-emerald-600" data-testid={`invite-negozio-chk-${n.id}`} />
                      {n.nome || n.name}
                    </label>
                  ))}
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">{form.negozi_ids.length} punti vendita selezionati</div>
              </div>
            )}

            <div>
              <Label className="text-xs uppercase tracking-widest">Scadenza accesso (opzionale)</Label>
              <Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="rounded-sm h-9 mt-1" data-testid="invite-expires" />
              <div className="text-[11px] text-zinc-500 mt-1">Vuoto = nessuna scadenza per venditori/gestori.</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-sm" disabled={submitting}>Annulla</Button>
            <Button onClick={submit} className="rounded-sm bg-zinc-900 text-white" data-testid="invite-submit" disabled={submitting}>
              {submitting ? "Creazione…" : "Crea utente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {lastInvite && <LastInviteModal invite={lastInvite} onClose={() => setLastInvite(null)} />}
    </div>
  );
}

function LastInviteModal({ invite, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const text = `Email: ${invite.email}\nPassword temporanea: ${invite.temporary_password}\nRuolo: ${invite.role}\n\nAccedi su: https://sadicasa.it/login\nDovrai cambiare la password al primo accesso.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()} data-testid="invite-result-modal">
        <div className="flex items-center gap-2 mb-2 text-emerald-600">
          <CheckCircle2 className="h-5 w-5" />
          <h3 className="text-lg font-bold">Utente creato!</h3>
        </div>
        <p className="text-sm text-zinc-600 mb-4">Annota o copia ORA le credenziali: la password temporanea NON sarà più visibile.</p>
        <div className="bg-zinc-50 border border-zinc-200 rounded p-3 space-y-2 text-sm">
          <div><strong>Email:</strong> <span className="mono">{invite.email}</span></div>
          <div><strong>Password temp:</strong> <span className="font-bold mono text-emerald-700">{invite.temporary_password}</span></div>
          <div><strong>Ruolo:</strong> {invite.role}{invite.role === "venditore" && invite.venditore_level ? ` (${invite.venditore_level})` : ""}</div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1 rounded-sm" onClick={copy} data-testid="copy-invite">
            <Copy className="h-4 w-4 mr-2" /> {copied ? "Copiato ✓" : "Copia credenziali"}
          </Button>
          <Button className="flex-1 rounded-sm bg-zinc-900 text-white" onClick={onClose} data-testid="invite-close">Ho salvato</Button>
        </div>
      </div>
    </div>
  );
}
