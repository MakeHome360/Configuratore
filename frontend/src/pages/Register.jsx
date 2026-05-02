import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { Check, Clock } from "lucide-react";

const RUOLI = [
  { value: "cliente", label: "Cliente", desc: "Voglio ristrutturare/arredare casa mia" },
  { value: "venditore", label: "Venditore", desc: "Lavoro come venditore in un punto vendita" },
  { value: "subappaltatore", label: "Subappaltatore / Fornitore", desc: "Eseguo lavori per conto di Sa di Casa" },
  { value: "gestore", label: "Gestore Cantieri (PM)", desc: "Sono Project Manager di cantiere" },
];

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [requestedRole, setRequestedRole] = useState("cliente");
  const [message, setMessage] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { register } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (password.length < 6) { setErr("Password di almeno 6 caratteri"); return; }
    setLoading(true);
    const res = await register({ name, email, password, requested_role: requestedRole, phone, message });
    setLoading(false);
    if (!res.ok) { setErr(res.error); toast.error(res.error); return; }
    setSent(true);
    toast.success("Richiesta inviata!");
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-xl mx-auto px-6 py-16" data-testid="register-page">
        {sent ? (
          <div className="text-center" data-testid="register-success">
            <div className="w-16 h-16 mx-auto bg-[#1FAE52] rounded-full flex items-center justify-center mb-6">
              <Check size={28} className="text-white" strokeWidth={3} />
            </div>
            <h1 className="text-4xl font-semibold tracking-tight mb-4" style={{ fontFamily: "Outfit" }}>Richiesta inviata.</h1>
            <p className="text-zinc-600 leading-relaxed mb-6 max-w-md mx-auto">
              Grazie <strong>{name}</strong>. La tua richiesta di accesso come <strong>{RUOLI.find(r => r.value === requestedRole)?.label.toLowerCase()}</strong> è stata ricevuta.
              L'amministratore la esaminerà e ti contatterà all'indirizzo <strong>{email}</strong> appena approvata.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full text-sm text-amber-900">
              <Clock size={14} /> In attesa di approvazione
            </div>
            <div className="mt-10">
              <Link to="/" className="text-[#1FAE52] underline underline-offset-4 font-semibold">Torna alla home</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Richiesta accesso</div>
            <h1 className="text-4xl font-semibold tracking-tight mb-3" style={{ fontFamily: "Outfit" }}>Crea il tuo account.</h1>
            <p className="text-zinc-600 mb-8 text-[15px] leading-relaxed">
              Compila il form: la tua richiesta verrà approvata manualmente dall'amministratore. Riceverai una notifica all'email indicata.
            </p>
            <form onSubmit={submit} className="space-y-5">
              <div>
                <Label className="text-xs uppercase tracking-widest text-zinc-500">Nome e cognome</Label>
                <Input required value={name} onChange={(e) => setName(e.target.value)} className="rounded-sm mt-1.5 h-11" placeholder="Mario Rossi" data-testid="register-name-input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-widest text-zinc-500">Email</Label>
                  <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-sm mt-1.5 h-11" data-testid="register-email-input" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-widest text-zinc-500">Telefono</Label>
                  <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-sm mt-1.5 h-11" placeholder="+39 ..." data-testid="register-phone-input" />
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-zinc-500">Password</Label>
                <Input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-sm mt-1.5 h-11" data-testid="register-password-input" />
                <div className="text-[11px] text-zinc-500 mt-1">Minimo 6 caratteri</div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-zinc-500 mb-2 block">Tipo di accesso richiesto</Label>
                <div className="space-y-2" data-testid="register-role-group">
                  {RUOLI.map((r) => (
                    <label
                      key={r.value}
                      className={`flex items-start gap-3 p-3 border rounded cursor-pointer transition-colors ${
                        requestedRole === r.value ? "border-[#1FAE52] bg-[#1FAE52]/5" : "border-zinc-200 hover:border-zinc-400"
                      }`}
                      data-testid={`register-role-${r.value}`}
                    >
                      <input type="radio" name="role" value={r.value} checked={requestedRole === r.value} onChange={(e) => setRequestedRole(e.target.value)} className="mt-1 accent-[#1FAE52]" />
                      <div>
                        <div className="font-semibold text-[14px]">{r.label}</div>
                        <div className="text-[12px] text-zinc-600">{r.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-zinc-500">Messaggio (opzionale)</Label>
                <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full mt-1.5 border border-zinc-200 rounded-sm px-3 py-2 text-sm focus:border-[#1FAE52] focus:outline-none resize-none" placeholder="Raccontaci brevemente chi sei e perché vuoi accedere…" data-testid="register-message-input" />
              </div>
              {err && <div className="text-sm text-red-600" data-testid="register-error">{err}</div>}
              <Button type="submit" disabled={loading} className="rounded-full w-full h-12 bg-[#1FAE52] hover:bg-[#168540] text-white font-semibold" data-testid="register-submit">
                {loading ? "Invio in corso…" : "Invia richiesta di accesso"}
              </Button>
              <div className="text-xs text-zinc-500 text-center leading-relaxed">
                Inviando la richiesta accetti che i tuoi dati vengano esaminati per la valutazione dell'accesso.
              </div>
            </form>
            <div className="mt-8 text-sm text-zinc-600 text-center">
              Hai già un account? <Link to="/login" className="text-[#1FAE52] font-semibold underline underline-offset-4" data-testid="goto-login-link">Accedi</Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
