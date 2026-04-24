import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { toast } from "sonner";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (password.length < 6) { setErr("Password di almeno 6 caratteri"); return; }
    setLoading(true);
    const res = await register(name, email, password);
    setLoading(false);
    if (!res.ok) { setErr(res.error); toast.error(res.error); return; }
    toast.success("Account creato!");
    nav("/dashboard");
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-md mx-auto px-6 py-16" data-testid="register-page">
        <div className="label-kicker mb-3">Registrazione</div>
        <h1 className="text-4xl font-semibold tracking-tight mb-8" style={{ fontFamily: "Outfit" }}>Crea il tuo account.</h1>
        <form onSubmit={submit} className="space-y-5">
          <div>
            <Label htmlFor="name" className="text-xs uppercase tracking-widest text-zinc-500">Nome</Label>
            <Input
              id="name" value={name} onChange={(e) => setName(e.target.value)} required
              className="rounded-sm mt-1.5 h-11"
              placeholder="Mario Rossi"
              data-testid="register-name-input"
            />
          </div>
          <div>
            <Label htmlFor="email" className="text-xs uppercase tracking-widest text-zinc-500">Email</Label>
            <Input
              id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="rounded-sm mt-1.5 h-11"
              data-testid="register-email-input"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-xs uppercase tracking-widest text-zinc-500">Password</Label>
            <Input
              id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="rounded-sm mt-1.5 h-11"
              data-testid="register-password-input"
            />
          </div>
          {err && <div className="text-sm text-red-600" data-testid="register-error">{err}</div>}
          <Button type="submit" disabled={loading} className="rounded-sm w-full h-11 bg-zinc-900 hover:bg-zinc-800" data-testid="register-submit">
            {loading ? "Creazione…" : "Crea account"}
          </Button>
        </form>
        <div className="mt-6 text-sm text-zinc-600">
          Hai già un account?{" "}
          <Link to="/login" className="text-zinc-900 underline underline-offset-4" data-testid="goto-login-link">Accedi</Link>
        </div>
      </main>
    </div>
  );
}
