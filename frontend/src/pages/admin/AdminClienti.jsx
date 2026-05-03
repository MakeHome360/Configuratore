import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";
import { toast } from "sonner";
import { UserPlus, Trash2, Mail, Phone, Calendar, Copy, CheckCircle2, AlertCircle, Search, ExternalLink } from "lucide-react";

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("it-IT"); } catch { return "—"; }
}
function daysUntil(iso) {
  if (!iso) return null;
  return Math.round((new Date(iso) - new Date()) / (1000 * 60 * 60 * 24));
}

export default function AdminClienti() {
  const [users, setUsers] = useState([]);
  const [commesse, setCommesse] = useState([]);
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCantiereOpen, setInviteCantiereOpen] = useState(false);
  const [lastInvite, setLastInvite] = useState(null);

  const load = async () => {
    const [u, c] = await Promise.all([
      api.get("/users"),
      api.get("/commesse").catch(() => ({ data: [] })),
    ]);
    setUsers((u.data || []).filter(x => x.role === "cliente"));
    setCommesse(c.data || []);
  };
  useEffect(() => { load(); }, []);

  const del = async (u) => {
    if (!window.confirm(`Cancellare il cliente ${u.email}?\n(I suoi dati personali verranno rimossi)`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success("Cliente cancellato");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore");
    }
  };

  const setExpiry = async (u, iso) => {
    await api.patch(`/users/${u.id}/expiry`, { expires_at: iso });
    toast.success("Scadenza aggiornata");
    load();
  };
  const extendMonths = (u, m) => {
    const base = u.expires_at && new Date(u.expires_at) > new Date() ? new Date(u.expires_at) : new Date();
    base.setMonth(base.getMonth() + m);
    setExpiry(u, base.toISOString());
  };

  const filtered = users.filter(u => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (u.name || "").toLowerCase().includes(s) || (u.email || "").toLowerCase().includes(s) || (u.phone || "").includes(s);
  });

  return (
    <div>
      <PageHeader title="Clienti" subtitle="Gestisci i clienti del portale, inviti e accessi" />
      <Page>
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Cerca per nome, email, telefono…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-full text-sm focus:border-[#1FAE52] focus:outline-none"
              data-testid="clienti-search"
            />
          </div>
          <button
            onClick={() => setInviteOpen(true)}
            className="px-5 py-2 bg-[#0A0A0A] text-white rounded-full text-sm font-semibold hover:bg-[#1FAE52] flex items-center gap-2"
            data-testid="invita-cliente-libero"
          >
            <UserPlus size={14} /> Invita cliente
          </button>
          <button
            onClick={() => setInviteCantiereOpen(true)}
            className="px-5 py-2 bg-[#1FAE52] text-white rounded-full text-sm font-semibold hover:bg-[#168540] flex items-center gap-2"
            data-testid="invita-cliente-cantiere"
          >
            <UserPlus size={14} /> Invita per cantiere (con OTP)
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg p-12 text-center text-zinc-500">
            Nessun cliente {search ? "trovato per la ricerca" : "registrato. Inizia invitandone uno."}
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-3 text-left">Cliente</th>
                  <th className="px-3 py-3 text-left">Contatti</th>
                  <th className="px-3 py-3 text-left">Cantiere</th>
                  <th className="px-3 py-3 text-left">Stato</th>
                  <th className="px-3 py-3 text-left">Scadenza</th>
                  <th className="px-3 py-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((u) => {
                  const days = daysUntil(u.expires_at);
                  const cantiere = commesse.find(c => c.id === u.commessa_id);
                  return (
                    <tr key={u.id} data-testid={`cliente-row-${u.id}`}>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#1FAE52]/10 text-[#1FAE52] flex items-center justify-center font-bold">
                            {(u.name || u.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold">{u.name}</div>
                            <div className="text-[11px] text-zinc-500">id: {u.id.substring(0, 8)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[12px]">
                        <div className="flex items-center gap-1"><Mail size={11} /> {u.email}</div>
                        {u.phone && <div className="flex items-center gap-1 text-zinc-500"><Phone size={11} /> {u.phone}</div>}
                      </td>
                      <td className="px-3 py-3 text-[12px]">
                        {cantiere ? (
                          <div>
                            <div className="font-semibold">{cantiere.titolo || cantiere.name}</div>
                            <div className="text-[11px] text-zinc-500">{cantiere.indirizzo || "—"}</div>
                          </div>
                        ) : <span className="text-zinc-400">Nessuno</span>}
                      </td>
                      <td className="px-3 py-3">
                        {u.status === "expired" ? <span className="text-[11px] px-2 py-0.5 bg-zinc-200 rounded">Scaduto</span> :
                          u.must_change_password ? <span className="text-[11px] px-2 py-0.5 bg-amber-100 text-amber-900 rounded">Da attivare</span> :
                          <span className="text-[11px] px-2 py-0.5 bg-green-100 text-green-900 rounded">Attivo</span>}
                      </td>
                      <td className="px-3 py-3 text-[12px]">
                        {u.expires_at ? (
                          <div>
                            <div className="flex items-center gap-1"><Calendar size={11} /> {fmtDate(u.expires_at)}</div>
                            <div className={`text-[10px] ${days < 30 ? "text-red-600" : "text-zinc-500"}`}>
                              {days > 0 ? `tra ${days} giorni` : `scaduto da ${-days}gg`}
                            </div>
                          </div>
                        ) : <span className="text-green-700 text-[11px]">Senza scadenza</span>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => extendMonths(u, 6)} className="text-[11px] px-2 py-1 border border-zinc-300 rounded hover:bg-zinc-50" title="Estendi +6 mesi (durata cantiere)">+6m</button>
                          <button onClick={() => extendMonths(u, 12)} className="text-[11px] px-2 py-1 border border-zinc-300 rounded hover:bg-zinc-50">+1a</button>
                          <button onClick={() => del(u)} className="text-[11px] p-1.5 text-red-600 hover:bg-red-50 rounded" title="Cancella" data-testid={`delete-cliente-${u.id}`}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {inviteOpen && <InviteFreeClient onClose={() => setInviteOpen(false)} onDone={(d) => { setInviteOpen(false); setLastInvite(d); load(); }} />}
        {inviteCantiereOpen && <InviteCantiereClient commesse={commesse} onClose={() => setInviteCantiereOpen(false)} onDone={(d) => { setInviteCantiereOpen(false); setLastInvite(d); load(); }} />}
        {lastInvite && <LastInviteCard invite={lastInvite} onClose={() => setLastInvite(null)} />}
      </Page>
    </div>
  );
}

function InviteFreeClient({ onClose, onDone }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = { name, email, phone, role: "cliente" };
      if (expiresAt) body.expires_at = new Date(expiresAt + "T00:00:00").toISOString();
      const { data } = await api.post("/users/invite", body);
      toast.success("Cliente invitato");
      onDone({ ...data, type: "free" });
    } catch (e) { toast.error(e.response?.data?.detail || "Errore"); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()} data-testid="invite-free-modal">
        <h3 className="text-xl font-bold mb-1" style={{ fontFamily: "Outfit" }}>Invita cliente</h3>
        <p className="text-sm text-zinc-600 mb-5">Crea l'account cliente con password temporanea (per uso generico, non legato a un cantiere specifico).</p>
        <div className="space-y-4">
          <input required placeholder="Nome e cognome" className="w-full border border-zinc-300 rounded h-10 px-3" value={name} onChange={(e) => setName(e.target.value)} data-testid="invite-cli-name" />
          <input required type="email" placeholder="Email" className="w-full border border-zinc-300 rounded h-10 px-3" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="invite-cli-email" />
          <input type="tel" placeholder="Telefono" className="w-full border border-zinc-300 rounded h-10 px-3" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-500">Scadenza (opzionale)</label>
            <input type="date" className="w-full border border-zinc-300 rounded h-10 px-3 mt-1" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            <div className="text-[11px] text-zinc-500 mt-1">Default: 6 mesi</div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-zinc-300 rounded-full text-sm font-semibold hover:bg-zinc-50">Annulla</button>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-[#1FAE52] text-white rounded-full text-sm font-semibold hover:bg-[#168540]" data-testid="invite-cli-submit">
            {loading ? "…" : "Invia invito"}
          </button>
        </div>
      </form>
    </div>
  );
}

function InviteCantiereClient({ commesse, onClose, onDone }) {
  const [commessaId, setCommessaId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [duraGiorni, setDuraGiorni] = useState(30);
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!commessaId) { toast.error("Seleziona un cantiere"); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/cliente-portal/invita", { commessa_id: commessaId, email, nome: name, durata_giorni: duraGiorni });
      toast.success("Cliente invitato al portale cantiere");
      onDone({ ...data, type: "cantiere", temporary_password: data.password_temporanea, expires_at: data.scadenza, login_url: data.url_login });
    } catch (e) { toast.error(e.response?.data?.detail || "Errore"); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()} data-testid="invite-cantiere-modal">
        <h3 className="text-xl font-bold mb-1" style={{ fontFamily: "Outfit" }}>Invita cliente al cantiere</h3>
        <p className="text-sm text-zinc-600 mb-5">Crea accesso al portale cliente con OTP, collegato a una commessa specifica. Validità: durata cantiere + N giorni.</p>
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-500">Cantiere / Commessa</label>
            <select required className="w-full border border-zinc-300 rounded h-10 px-3 mt-1" value={commessaId} onChange={(e) => setCommessaId(e.target.value)} data-testid="invite-comm-select">
              <option value="">— seleziona —</option>
              {commesse.map((c) => <option key={c.id} value={c.id}>{c.titolo || c.name} {c.indirizzo ? `· ${c.indirizzo}` : ""}</option>)}
            </select>
          </div>
          <input required placeholder="Nome cliente" className="w-full border border-zinc-300 rounded h-10 px-3" value={name} onChange={(e) => setName(e.target.value)} />
          <input required type="email" placeholder="Email cliente" className="w-full border border-zinc-300 rounded h-10 px-3" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-500">Giorni accesso post-fine cantiere</label>
            <input type="number" className="w-full border border-zinc-300 rounded h-10 px-3 mt-1" value={duraGiorni} onChange={(e) => setDuraGiorni(parseInt(e.target.value) || 30)} />
            <div className="text-[11px] text-zinc-500 mt-1">L'accesso resta attivo 6 mesi + i giorni indicati (per garanzie/collaudo)</div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-zinc-300 rounded-full text-sm font-semibold hover:bg-zinc-50">Annulla</button>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-[#1FAE52] text-white rounded-full text-sm font-semibold hover:bg-[#168540]" data-testid="invite-cantiere-submit">
            {loading ? "…" : "Crea accesso"}
          </button>
        </div>
      </form>
    </div>
  );
}

function LastInviteCard({ invite, onClose }) {
  const [copied, setCopied] = useState(false);
  const portalUrl = invite.type === "cantiere" ? invite.login_url || "/portale-cliente/login" : invite.login_url || "/login";
  const text = `Ciao,\nti abbiamo creato l'accesso a "Sa di Casa".\n\nEmail: ${invite.email}\nPassword temporanea: ${invite.temporary_password}\n\nAccedi su: https://sadicasa.it${portalUrl}\nTi sarà chiesto di cambiare la password al primo accesso.\n\nGrazie,\nIl team di Sa di Casa`;
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6" data-testid="cli-invite-result">
        <div className="w-14 h-14 bg-[#1FAE52]/10 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 size={24} className="text-[#1FAE52]" />
        </div>
        <h3 className="text-xl font-bold mb-1" style={{ fontFamily: "Outfit" }}>Cliente invitato!</h3>
        <p className="text-sm text-zinc-600 mb-5">Copia il messaggio sotto e invialo via email/WhatsApp al cliente.</p>
        <div className="bg-zinc-50 border border-zinc-200 rounded p-3 mb-4 mono text-xs leading-relaxed whitespace-pre-wrap">{text}</div>
        <div className="flex gap-3">
          <button onClick={copy} className="flex-1 py-2.5 bg-[#0A0A0A] text-white rounded-full text-sm font-semibold hover:bg-[#1FAE52] flex items-center justify-center gap-2">
            {copied ? <><CheckCircle2 size={14} /> Copiato!</> : <><Copy size={14} /> Copia messaggio</>}
          </button>
          <a href={portalUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-4 py-2.5 border border-zinc-300 rounded-full text-sm font-semibold hover:bg-zinc-50">
            <ExternalLink size={12} /> Portale
          </a>
          <button onClick={onClose} className="px-4 py-2.5 border border-zinc-300 rounded-full text-sm font-semibold hover:bg-zinc-50">Chiudi</button>
        </div>
        <div className="text-[11px] text-zinc-500 mt-4 flex items-start gap-2">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
          <span>Scadenza accesso: {fmtDate(invite.expires_at)}. La password verrà mostrata solo ora.</span>
        </div>
      </div>
    </div>
  );
}
