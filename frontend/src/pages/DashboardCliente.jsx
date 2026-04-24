import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader, StatCard, fmtEur } from "@/components/ui-kit";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardCliente() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ preventivi: 0, commesse: 0, investimento: 0 });
  useEffect(() => {
    api.get("/stats/dashboard").then((r) => setStats({
      preventivi: r.data.preventivi_totali || 0,
      commesse: r.data.commesse_attive || 0,
      investimento: r.data.fatturato_totale || 0,
    }));
  }, []);
  return (
    <div>
      <PageHeader title={`Ciao ${user?.name || ""}, Benvenuto! 👋`} subtitle="Segui qui lo stato della tua ristrutturazione" />
      <Page>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Preventivi" value={stats.preventivi} />
          <StatCard label="Commesse" value={stats.commesse} />
          <StatCard label="Investimento totale" value={fmtEur(stats.investimento)} />
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold mb-2">I tuoi preventivi</h3>
          <p className="text-zinc-500">Il tuo consulente ti invierà il preventivo a breve</p>
        </div>
      </Page>
    </div>
  );
}
