import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

export default function CambiaPassword() {
  const { user, changePassword } = useAuth();
  const nav = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const forced = !!user?.must_change_password;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (next.length < 6) { setErr("La nuova password deve avere almeno 6 caratteri"); return; }
    if (next !== confirm) { setErr("Le password non coincidono"); return; }
    setLoading(true);
    const res = await changePassword({ current_password: forced ? undefined : current, new_password: next });
    setLoading(false);
    if (!res.ok) { setErr(res.error); toast.error(res.error); return; }
    toast.success("Password aggiornata!");
    nav("/dashboard");
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-md mx-auto px-6 py-16" data-testid="change-password-page">
        <div className="w-14 h-14 bg-[#1FAE52]/10 rounded-full flex items-center justify-center mb-6">
          <KeyRound size={22} className="text-[#1FAE52]" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-3" style={{ fontFamily: "Outfit" }}>
          {forced ? "Imposta la tua password" : "Cambia la password"}
        </h1>
        <p className="text-zinc-600 mb-8 text-[14px] leading-relaxed">
          {forced
            ? "Il tuo account è stato creato dall'amministratore. Imposta ora una password personale sicura prima di continuare."
            : "Cambia la tua password. Ti verrà chiesto di inserire quella attuale per conferma."}
        </p>
        <form onSubmit={submit} className="space-y-5">
          {!forced && (
            <div>
              <Label className="text-xs uppercase tracking-widest text-zinc-500">Password attuale</Label>
              <Input required type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="rounded-sm mt-1.5 h-11" data-testid="current-password-input" />
            </div>
          )}
          <div>
            <Label className="text-xs uppercase tracking-widest text-zinc-500">Nuova password</Label>
            <Input required type="password" value={next} onChange={(e) => setNext(e.target.value)} className="rounded-sm mt-1.5 h-11" data-testid="new-password-input" />
            <div className="text-[11px] text-zinc-500 mt-1">Minimo 6 caratteri</div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-zinc-500">Conferma nuova password</Label>
            <Input required type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="rounded-sm mt-1.5 h-11" data-testid="confirm-password-input" />
          </div>
          {err && <div className="text-sm text-red-600" data-testid="change-password-error">{err}</div>}
          <Button type="submit" disabled={loading} className="rounded-full w-full h-12 bg-[#1FAE52] hover:bg-[#168540] text-white font-semibold" data-testid="change-password-submit">
            {loading ? "Salvataggio…" : forced ? "Imposta password e continua" : "Cambia password"}
          </Button>
        </form>
      </main>
    </div>
  );
}
