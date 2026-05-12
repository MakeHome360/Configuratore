import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Page } from "@/components/ui-kit";

// La gestione commessa è stata UNIFICATA nel "Workflow Cantiere" (/commesse/:cid/workflow).
// Questo componente redirige automaticamente al workflow per eliminare la duplicazione
// (es. la tab "Documenti" che esisteva sia qui che nel workflow).
export default function DettaglioCommessa() {
  const { id } = useParams();
  const nav = useNavigate();
  useEffect(() => {
    if (id) nav(`/commesse/${id}/workflow`, { replace: true });
  }, [id, nav]);
  return (
    <Page>
      <div className="text-zinc-500 text-sm" data-testid="dettaglio-commessa-redirect">
        Apertura workflow del cantiere…
      </div>
    </Page>
  );
}
