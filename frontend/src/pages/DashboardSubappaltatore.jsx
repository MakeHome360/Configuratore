import React from "react";
import { Page, PageHeader } from "@/components/ui-kit";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardSubappaltatore() {
  const { user } = useAuth();
  return (
    <div>
      <PageHeader title="Dashboard Subappaltatore" subtitle="Le tue lavorazioni e pagamenti" />
      <Page>
        <div className="bg-white border border-zinc-200 rounded-lg p-6 text-center max-w-lg mx-auto">
          <h3 className="text-lg font-semibold mb-2">Profilo</h3>
          <p className="text-zinc-500 mb-2">Email: {user?.email}</p>
          <p className="text-sm text-zinc-500">Contatta l'amministratore per essere associato a un profilo subappaltatore e vedere i tuoi cantieri.</p>
        </div>
      </Page>
    </div>
  );
}
