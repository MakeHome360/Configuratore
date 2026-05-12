import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

// La gestione commessa è UNIFICATA nella sola pagina "Workflow Cantiere".
// Niente più tab gemelle. Tutte le funzionalità (Calendario, Voci-Acquisti, Dati Economici,
// Rilievo misure) sono dentro il workflow.
export default function DettaglioCommessa() {
  const { id } = useParams();
  const nav = useNavigate();
  useEffect(() => {
    if (id) nav(`/commesse/${id}/workflow`, { replace: true });
  }, [id, nav]);
  return <div className="p-8 text-sm text-zinc-500" data-testid="dettaglio-commessa-redirect">Apertura workflow cantiere…</div>;
}
