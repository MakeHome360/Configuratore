import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function AdminImpostazioni() {
  const [imp, setImp] = useState({});
  useEffect(() => { api.get("/impostazioni").then((r) => setImp(r.data || {})); }, []);
  const save = async () => { await api.put("/impostazioni", imp); toast.success("Salvato"); };

  const F = ({ label, k, unit = "" }) => (
    <div><Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input type="number" step="0.1" value={imp[k] || 0} onChange={(e) => setImp({ ...imp, [k]: Number(e.target.value) })} data-testid={`imp-${k}`} />
        {unit && <span className="text-sm text-zinc-500">{unit}</span>}
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Impostazioni" subtitle="Configura parametri di calcolo e ricarichi"
        actions={<Button onClick={save} data-testid="imp-save" style={{ background: "var(--brand)", color: "white" }}>Salva</Button>} />
      <Page>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-5xl">
          <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
            <h3 className="font-semibold">Generale</h3>
            <F label="Margine minimo richiesto" k="margine_minimo" unit="%" />
            <F label="Costi fissi per commessa" k="costi_fissi_commessa" unit="€" />
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
            <h3 className="font-semibold">IVA</h3>
            <F label="IVA ristrutturazione" k="iva_ristrutturazione" unit="%" />
            <F label="IVA standard" k="iva_standard" unit="%" />
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
            <h3 className="font-semibold">Ricarichi</h3>
            <F label="Ricarico default voci" k="ricarico_default" unit="x" />
            <F label="Sicurezza cantiere" k="sicurezza_pct" unit="%" />
            <F label="Direzione lavori" k="direzione_lavori_pct" unit="%" />
          </div>
        </div>
        <div className="mt-4 text-xs text-zinc-500 bg-amber-50 border border-amber-200 p-3 rounded max-w-5xl">
          <strong>Nota:</strong> Le modifiche avranno effetto solo sui nuovi preventivi. I preventivi esistenti non verranno modificati.
        </div>
      </Page>
    </div>
  );
}
