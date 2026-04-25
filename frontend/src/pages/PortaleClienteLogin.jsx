import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function PortaleClienteLogin() {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { setUserAndToken } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.post("/auth/login-cliente", { email, password: pwd });
      const { access_token, user } = r.data;
      // Salva via context (riusiamo lo stesso storage del login normale)
      if (setUserAndToken) {
        setUserAndToken({ token: access_token, user });
      } else {
        localStorage.setItem("access_token", access_token);
        localStorage.setItem("user", JSON.stringify(user));
      }
      toast.success(`Benvenuto ${user.name}`);
      nav("/portale-cliente");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Credenziali non valide");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-700 via-teal-700 to-zinc-900 p-6">
      <div className="bg-white rounded-md shadow-xl p-8 w-full max-w-md">
        <div className="mb-6">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Portale Cliente</div>
          <h1 className="text-2xl font-semibold mt-1">Accedi alla tua commessa</h1>
          <p className="text-xs text-zinc-500 mt-2">Usa le credenziali temporanee che ti ha fornito il venditore. La password è valida per la durata del cantiere + 30 giorni.</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label className="text-xs uppercase tracking-widest text-zinc-500">Email</Label>
            <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="rounded-sm h-10 mt-1.5" data-testid="cliente-email" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-zinc-500">Password temporanea</Label>
            <Input type="password" required value={pwd} onChange={e => setPwd(e.target.value)} className="rounded-sm h-10 mt-1.5 mono tracking-[0.2em]" data-testid="cliente-password" />
          </div>
          <Button type="submit" disabled={loading} className="w-full rounded-sm h-10 bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="cliente-login-submit">
            {loading ? "Accesso…" : "Entra nel mio portale"}
          </Button>
        </form>
      </div>
    </div>
  );
}
