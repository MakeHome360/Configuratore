import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";
import { toast } from "sonner";
import { Check, X, Trash2, Mail, Clock, Calendar, UserPlus, Users, AlertCircle, Copy, CheckCircle2 } from "lucide-react";

const ROLES = [
  { value: "cliente", label: "Cliente" },
  { value: "venditore", label: "Venditore" },
  { value: "subappaltatore", label: "Subappaltatore" },
  { value: "gestore", label: "Gestore Cantieri" },
  { value: "admin", label: "Admin" },
];

const VENDITORE_LEVELS = [
  { value: "semplice", label: "Venditore semplice" },
  { value: "responsabile", label: "Responsabile Punto Vendita" },
  { value: "area_manager", label: "Area Manager (più PV)" },
];

const STATUS_LABELS = {
  pending: { label: "In attesa", color: "bg-amber-100 text-amber-900 border-amber-200" },
  active: { label: "Attivo", color: "bg-green-100 text-green-900 border-green-200" },
  rejected: { label: "Rifiutato", color: "bg-red-100 text-red-900 border-red-200" },
  expired: { label: "Scaduto", color: "bg-zinc-200 text-zinc-700 border-zinc-300" },
};

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("it-IT"); } catch { return "—"; }
}

function daysUntil(iso) {
  if (!iso) return null;
  const ms = new Date(iso) - new Date();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export default function AdminUtenti() {
  const [tab, setTab] = useState("pending");
  const [users, setUsers] = useState([]);
  const [pending, setPending] = useState([]);
  const [negozi, setNegozi] = useState([]);
  const [loading, setLoading] = useState(false);

  // modals
  const [approveModal, setApproveModal] = useState(null); // user
  const [inviteModal, setInviteModal] = useState(false);
  const [lastInvite, setLastInvite] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [a, b, n] = await Promise.all([
        api.get("/users"),
        api.get("/users/pending"),
        api.get("/negozi").catch(() => ({ data: [] })),
      ]);
      setUsers(a.data || []);
      setPending(b.data || []);
      setNegozi(n.data || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const reject = async (u) => {
    if (!window.confirm(`Rifiutare la richiesta di ${u.email}?`)) return;
    await api.post(`/users/${u.id}/reject`);
    toast.success("Richiesta rifiutata");
    load();
  };

  const del = async (u) => {
    if (!window.confirm(`Cancellare definitivamente ${u.email}? Non reversibile.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success("Utente cancellato");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore cancellazione");
    }
  };

  const setExpiry = async (u, iso) => {
    await api.patch(`/users/${u.id}/expiry`, { expires_at: iso });
    toast.success("Scadenza aggiornata");
    load();
  };

  const extendMonths = (u, months) => {
    const base = u.expires_at && new Date(u.expires_at) > new Date() ? new Date(u.expires_at) : new Date();
    base.setMonth(base.getMonth() + months);
    setExpiry(u, base.toISOString());
  };

  const removeExpiry = (u) => setExpiry(u, null);

  const setRole = async (u, role) => {
    await api.put(`/users/${u.id}/role`, { role });
    toast.success("Ruolo aggiornato");
    load();
  };

  const setAttr = async (u, attrs) => {
    await api.put(`/users/${u.id}`, attrs);
    toast.success("Aggiornato");
    load();
  };

  const activeUsers = users.filter((u) => u.status !== "pending");

  return (
    <div>
      <PageHeader title="Utenti & Accessi" subtitle="Gestisci richieste, inviti, ruoli e scadenze" />
      <Page>
        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-100 rounded-full p-1 w-fit mb-6">
          <button
            onClick={() => setTab("pending")}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${tab === "pending" ? "bg-white shadow-sm text-[#0A0A0A]" : "text-zinc-600 hover:text-[#0A0A0A]"}`}
            data-testid="tab-pending"
          >
            Richieste {pending.length > 0 && <span className="ml-2 inline-block bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pending.length}</span>}
          </button>
          <button
            onClick={() => setTab("attivi")}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${tab === "attivi" ? "bg-white shadow-sm text-[#0A0A0A]" : "text-zinc-600 hover:text-[#0A0A0A]"}`}
            data-testid="tab-attivi"
          >
            Utenti attivi ({activeUsers.length})
          </button>
          <button
            onClick={() => setInviteModal(true)}
            className="ml-2 px-5 py-2 rounded-full text-sm font-semibold bg-[#1FAE52] text-white hover:bg-[#168540] flex items-center gap-2"
            data-testid="tab-invita"
          >
            <UserPlus size={14} /> Invita utente
          </button>
        </div>

        {loading && <div className="text-sm text-zinc-500">Caricamento…</div>}

        {/* === PENDING TAB === */}
        {tab === "pending" && (
          <div>
            {pending.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-lg p-12 text-center text-zinc-500">
                <CheckCircle2 size={32} className="mx-auto mb-3 text-zinc-400" />
                Nessuna richiesta in attesa di approvazione.
              </div>
            ) : (
              <div className="space-y-3" data-testid="pending-list">
                {pending.map((u) => (
                  <div key={u.id} className="bg-white border border-amber-200 rounded-lg p-5 flex items-start justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-sm">
                          {(u.name || u.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-[16px]">{u.name}</div>
                          <div className="text-[13px] text-zinc-600">{u.email} {u.phone && `· ${u.phone}`}</div>
                        </div>
                      </div>
                      <div className="text-[13px] mb-2">
                        <span className="text-zinc-500">Ruolo richiesto:</span> <strong>{ROLES.find(r => r.value === u.requested_role)?.label || u.requested_role}</strong>
                      </div>
                      {u.message && <div className="text-[13px] text-zinc-700 bg-zinc-50 p-2 rounded italic">«{u.message}»</div>}
                      <div className="text-[11px] text-zinc-500 mt-2">Richiesta il {fmtDate(u.created_at)}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => reject(u)} className="px-4 py-2 border border-red-300 text-red-700 rounded-full text-sm font-semibold hover:bg-red-50 flex items-center gap-1" data-testid={`reject-${u.id}`}>
                        <X size={14} /> Rifiuta
                      </button>
                      <button onClick={() => setApproveModal(u)} className="px-4 py-2 bg-[#1FAE52] text-white rounded-full text-sm font-semibold hover:bg-[#168540] flex items-center gap-1" data-testid={`approve-${u.id}`}>
                        <Check size={14} /> Approva
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === ATTIVI TAB === */}
        {tab === "attivi" && (
          <div className="bg-white border border-zinc-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-3 text-left">Utente</th>
                  <th className="px-3 py-3 text-left">Ruolo</th>
                  <th className="px-3 py-3 text-left">Livello / Negozi</th>
                  <th className="px-3 py-3 text-left">Stato</th>
                  <th className="px-3 py-3 text-left">Scadenza</th>
                  <th className="px-3 py-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {activeUsers.map((u) => {
                  const days = daysUntil(u.expires_at);
                  const st = STATUS_LABELS[u.status || "active"] || STATUS_LABELS.active;
                  return (
                    <tr key={u.id} data-testid={`user-row-${u.id}`}>
                      <td className="px-3 py-3">
                        <div className="font-semibold">{u.name}</div>
                        <div className="text-[12px] text-zinc-500">{u.email}</div>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className="border border-zinc-300 rounded h-8 px-2 text-sm"
                          value={u.role}
                          onChange={(e) => setRole(u, e.target.value)}
                          data-testid={`role-${u.id}`}
                        >
                          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3 text-[12px]">
                        {u.role === "venditore" ? (
                          <div className="space-y-1">
                            <select
                              className="border border-zinc-300 rounded h-7 px-1 text-xs w-full"
                              value={u.venditore_level || "semplice"}
                              onChange={(e) => setAttr(u, { venditore_level: e.target.value })}
                            >
                              {VENDITORE_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                            </select>
                            {(u.venditore_level === "responsabile" || u.venditore_level === "area_manager") && (
                              <div className="text-[11px] text-zinc-500">
                                {u.negozi_ids?.length || 0} negozi gestiti
                              </div>
                            )}
                            {u.venditore_level === "semplice" && u.negozio_id && (
                              <div className="text-[11px] text-zinc-500">
                                Negozio: {negozi.find(n => n.id === u.negozio_id)?.nome || u.negozio_id}
                              </div>
                            )}
                          </div>
                        ) : <span className="text-zinc-400">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${st.color}`}>{st.label}</span>
                        {u.must_change_password && <div className="text-[10px] text-amber-700 mt-1">⚠ Deve cambiare pwd</div>}
                      </td>
                      <td className="px-3 py-3 text-[12px]">
                        {u.expires_at ? (
                          <div>
                            <div className="flex items-center gap-1"><Calendar size={11} /> {fmtDate(u.expires_at)}</div>
                            <div className={`text-[10px] ${days < 30 ? "text-red-600" : "text-zinc-500"}`}>
                              {days > 0 ? `tra ${days} giorni` : `scaduto da ${-days} giorni`}
                            </div>
                          </div>
                        ) : <span className="text-green-700 text-[11px]">Senza scadenza</span>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => extendMonths(u, 3)} className="text-[11px] px-2 py-1 border border-zinc-300 rounded hover:bg-zinc-50" title="Estendi +3 mesi">+3m</button>
                          <button onClick={() => extendMonths(u, 12)} className="text-[11px] px-2 py-1 border border-zinc-300 rounded hover:bg-zinc-50" title="Estendi +12 mesi">+1a</button>
                          <button onClick={() => removeExpiry(u)} className="text-[11px] px-2 py-1 border border-zinc-300 rounded hover:bg-zinc-50" title="Nessuna scadenza">∞</button>
                          <button onClick={() => del(u)} className="text-[11px] p-1.5 text-red-600 hover:bg-red-50 rounded" title="Cancella" data-testid={`delete-${u.id}`}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Approve modal */}
        {approveModal && (
          <ApproveModal
            user={approveModal}
            negozi={negozi}
            onClose={() => setApproveModal(null)}
            onDone={() => { setApproveModal(null); load(); }}
          />
        )}

        {/* Invite modal */}
        {inviteModal && (
          <InviteModal
            negozi={negozi}
            onClose={() => setInviteModal(false)}
            onDone={(resp) => { setInviteModal(false); setLastInvite(resp); load(); }}
          />
        )}

        {/* Last invite credentials modal */}
        {lastInvite && <LastInviteModal invite={lastInvite} onClose={() => setLastInvite(null)} />}
      </Page>
    </div>
  );
}

function ApproveModal({ user, negozi, onClose, onDone }) {
  const [role, setRole] = useState(user.requested_role || "cliente");
  const [venditoreLevel, setVenditoreLevel] = useState("semplice");
  const [negozioId, setNegozioId] = useState("");
  const [negoziIds, setNegoziIds] = useState([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleNeg = (id) => setNegoziIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const submit = async () => {
    setLoading(true);
    try {
      const body = { role };
      if (expiresAt) body.expires_at = new Date(expiresAt + "T00:00:00").toISOString();
      if (role === "venditore") {
        body.venditore_level = venditoreLevel;
        if (venditoreLevel === "semplice" && negozioId) body.negozio_id = negozioId;
        if ((venditoreLevel === "responsabile" || venditoreLevel === "area_manager") && negoziIds.length) body.negozi_ids = negoziIds;
      }
      await api.post(`/users/${user.id}/approve`, body);
      toast.success(`${user.name} approvato come ${role}`);
      onDone();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore approvazione");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="approve-modal">
        <h3 className="text-xl font-bold mb-1" style={{ fontFamily: "Outfit" }}>Approva {user.name}</h3>
        <p className="text-sm text-zinc-600 mb-5">{user.email} · ha richiesto: {user.requested_role}</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-500">Ruolo assegnato</label>
            <select className="w-full border border-zinc-300 rounded h-10 px-3 mt-1" value={role} onChange={(e) => setRole(e.target.value)} data-testid="approve-role">
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {role === "venditore" && (
            <>
              <div>
                <label className="text-xs uppercase tracking-widest text-zinc-500">Livello venditore</label>
                <select className="w-full border border-zinc-300 rounded h-10 px-3 mt-1" value={venditoreLevel} onChange={(e) => setVenditoreLevel(e.target.value)}>
                  {VENDITORE_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              {venditoreLevel === "semplice" && (
                <div>
                  <label className="text-xs uppercase tracking-widest text-zinc-500">Negozio di appartenenza</label>
                  <select className="w-full border border-zinc-300 rounded h-10 px-3 mt-1" value={negozioId} onChange={(e) => setNegozioId(e.target.value)}>
                    <option value="">— seleziona —</option>
                    {negozi.map((n) => <option key={n.id} value={n.id}>{n.nome || n.name}</option>)}
                  </select>
                </div>
              )}
              {(venditoreLevel === "responsabile" || venditoreLevel === "area_manager") && negozi.length > 0 && (
                <div>
                  <label className="text-xs uppercase tracking-widest text-zinc-500">Negozi gestiti ({venditoreLevel === "responsabile" ? "1 o più" : "più PV"})</label>
                  <div className="mt-2 max-h-40 overflow-y-auto border border-zinc-200 rounded p-2 space-y-1">
                    {negozi.map((n) => (
                      <label key={n.id} className="flex items-center gap-2 text-sm cursor-pointer p-1 hover:bg-zinc-50 rounded">
                        <input type="checkbox" checked={negoziIds.includes(n.id)} onChange={() => toggleNeg(n.id)} className="accent-[#1FAE52]" />
                        {n.nome || n.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-500">Scadenza accesso (opzionale)</label>
            <input type="date" className="w-full border border-zinc-300 rounded h-10 px-3 mt-1" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} data-testid="approve-expiry" />
            <div className="text-[11px] text-zinc-500 mt-1">
              Se vuoto: default = {role === "cliente" ? "6 mesi" : role === "subappaltatore" ? "12 mesi" : "nessuna scadenza"}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-zinc-300 rounded-full text-sm font-semibold hover:bg-zinc-50">Annulla</button>
          <button onClick={submit} disabled={loading} className="flex-1 py-2.5 bg-[#1FAE52] text-white rounded-full text-sm font-semibold hover:bg-[#168540]" data-testid="approve-submit">
            {loading ? "…" : "Approva e crea accesso"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteModal({ negozi, onClose, onDone }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("cliente");
  const [venditoreLevel, setVenditoreLevel] = useState("semplice");
  const [negozioId, setNegozioId] = useState("");
  const [negoziIds, setNegoziIds] = useState([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleNeg = (id) => setNegoziIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = { name, email, role, phone };
      if (expiresAt) body.expires_at = new Date(expiresAt + "T00:00:00").toISOString();
      if (role === "venditore") {
        body.venditore_level = venditoreLevel;
        if (venditoreLevel === "semplice" && negozioId) body.negozio_id = negozioId;
        if ((venditoreLevel === "responsabile" || venditoreLevel === "area_manager") && negoziIds.length) body.negozi_ids = negoziIds;
      }
      const { data } = await api.post("/users/invite", body);
      toast.success("Utente invitato!");
      onDone(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore invito");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="invite-modal">
        <h3 className="text-xl font-bold mb-1" style={{ fontFamily: "Outfit" }}>Invita nuovo utente</h3>
        <p className="text-sm text-zinc-600 mb-5">Crea l'account e ricevi una password temporanea da consegnare all'utente.</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-500">Nome e cognome</label>
            <input required className="w-full border border-zinc-300 rounded h-10 px-3 mt-1" value={name} onChange={(e) => setName(e.target.value)} data-testid="invite-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-widest text-zinc-500">Email</label>
              <input required type="email" className="w-full border border-zinc-300 rounded h-10 px-3 mt-1" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="invite-email" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-zinc-500">Telefono</label>
              <input type="tel" className="w-full border border-zinc-300 rounded h-10 px-3 mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-500">Ruolo</label>
            <select className="w-full border border-zinc-300 rounded h-10 px-3 mt-1" value={role} onChange={(e) => setRole(e.target.value)} data-testid="invite-role">
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {role === "venditore" && (
            <>
              <div>
                <label className="text-xs uppercase tracking-widest text-zinc-500">Livello venditore</label>
                <select className="w-full border border-zinc-300 rounded h-10 px-3 mt-1" value={venditoreLevel} onChange={(e) => setVenditoreLevel(e.target.value)}>
                  {VENDITORE_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              {venditoreLevel === "semplice" && (
                <div>
                  <label className="text-xs uppercase tracking-widest text-zinc-500">Negozio</label>
                  <select className="w-full border border-zinc-300 rounded h-10 px-3 mt-1" value={negozioId} onChange={(e) => setNegozioId(e.target.value)}>
                    <option value="">—</option>
                    {negozi.map((n) => <option key={n.id} value={n.id}>{n.nome || n.name}</option>)}
                  </select>
                </div>
              )}
              {(venditoreLevel === "responsabile" || venditoreLevel === "area_manager") && negozi.length > 0 && (
                <div>
                  <label className="text-xs uppercase tracking-widest text-zinc-500">Negozi gestiti</label>
                  <div className="mt-2 max-h-40 overflow-y-auto border border-zinc-200 rounded p-2 space-y-1">
                    {negozi.map((n) => (
                      <label key={n.id} className="flex items-center gap-2 text-sm cursor-pointer p-1 hover:bg-zinc-50 rounded">
                        <input type="checkbox" checked={negoziIds.includes(n.id)} onChange={() => toggleNeg(n.id)} className="accent-[#1FAE52]" />
                        {n.nome || n.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-500">Scadenza accesso (opzionale)</label>
            <input type="date" className="w-full border border-zinc-300 rounded h-10 px-3 mt-1" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            <div className="text-[11px] text-zinc-500 mt-1">Default: cliente 6 mesi · subappaltatore 12 mesi · altri senza scadenza</div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-zinc-300 rounded-full text-sm font-semibold hover:bg-zinc-50">Annulla</button>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-[#1FAE52] text-white rounded-full text-sm font-semibold hover:bg-[#168540]" data-testid="invite-submit">
            {loading ? "…" : "Crea invito"}
          </button>
        </div>
      </form>
    </div>
  );
}

function LastInviteModal({ invite, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const text = `Email: ${invite.email}\nPassword temporanea: ${invite.temporary_password}\n\nAccedi su: https://sadicasa.it/login\nDovrai cambiare la password al primo accesso.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6" data-testid="invite-result-modal">
        <div className="w-14 h-14 bg-[#1FAE52]/10 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 size={24} className="text-[#1FAE52]" />
        </div>
        <h3 className="text-xl font-bold mb-1" style={{ fontFamily: "Outfit" }}>Utente invitato!</h3>
        <p className="text-sm text-zinc-600 mb-5">
          Copia queste credenziali e consegnale all'utente (via email/WhatsApp). Non potrai più vedere la password.
        </p>
        <div className="bg-zinc-50 border border-zinc-200 rounded p-4 mb-4 space-y-2 mono text-sm">
          <div><strong>Email:</strong> {invite.email}</div>
          <div><strong>Password temp:</strong> <span className="font-bold text-[#1FAE52]">{invite.temporary_password}</span></div>
          <div><strong>Ruolo:</strong> {invite.role}</div>
          {invite.expires_at && <div><strong>Scadenza:</strong> {fmtDate(invite.expires_at)}</div>}
        </div>
        <div className="flex gap-3">
          <button onClick={copy} className="flex-1 py-2.5 bg-[#0A0A0A] text-white rounded-full text-sm font-semibold hover:bg-[#1FAE52] flex items-center justify-center gap-2" data-testid="copy-invite">
            {copied ? <><CheckCircle2 size={14} /> Copiato!</> : <><Copy size={14} /> Copia credenziali</>}
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 border border-zinc-300 rounded-full text-sm font-semibold hover:bg-zinc-50">Chiudi</button>
        </div>
        <div className="text-[11px] text-zinc-500 mt-4 flex items-start gap-2">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
          <span>L'utente dovrà cambiare password al primo login.</span>
        </div>
      </div>
    </div>
  );
}
