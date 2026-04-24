import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (!res.ok) { setErr(res.error); toast.error(res.error); return; }
    toast.success("Benvenuto!");
    nav("/dashboard");
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-md mx-auto px-6 py-16" data-testid="login-page">
        <div className="label-kicker mb-3">Accesso</div>
        <h1 className="text-4xl font-semibold tracking-tight mb-8" style={{ fontFamily: "Outfit" }}>Bentornato.</h1>
        <form onSubmit={submit} className="space-y-5">
          <div>
            <Label htmlFor="email" className="text-xs uppercase tracking-widest text-zinc-500">Email</Label>
            <Input
              id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="rounded-sm mt-1.5 h-11"
              data-testid="login-email-input"
              placeholder="tu@studio.it"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-xs uppercase tracking-widest text-zinc-500">Password</Label>
            <Input
              id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="rounded-sm mt-1.5 h-11"
              data-testid="login-password-input"
            />
          </div>
          {err && <div className="text-sm text-red-600" data-testid="login-error">{err}</div>}
          <Button type="submit" disabled={loading} className="rounded-sm w-full h-11 bg-zinc-900 hover:bg-zinc-800" data-testid="login-submit">
            {loading ? "Accesso…" : "Entra"}
          </Button>
        </form>
        <div className="mt-6 text-sm text-zinc-600">
          Nuovo qui?{" "}
          <Link to="/register" className="text-zinc-900 underline underline-offset-4" data-testid="goto-register-link">Crea un account</Link>
        </div>
        <div className="mt-10 p-4 border border-zinc-200 text-xs text-zinc-500 mono" data-testid="demo-credentials">
          demo · admin@ristruttura.app / Admin12345!
        </div>
      </main>
    </div>
  );
}
