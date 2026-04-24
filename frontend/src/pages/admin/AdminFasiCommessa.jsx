import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";

export default function AdminFasiCommessa() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/fasi-commessa").then((r) => setRows(r.data || [])); }, []);
  return (
    <div>
      <PageHeader title="Fasi Commessa" subtitle="Configura la checklist delle fasi di lavorazione" />
      <Page>
        <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
          {rows.map((f) => (
            <div key={f.id} className="px-4 py-3 flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-bold">{f.order}</div>
              <div className="flex-1">
                <div className="font-medium">{f.name}</div>
                <div className="text-xs text-zinc-500">{f.description}</div>
              </div>
              {f.has_doc && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Doc</span>}
              {f.obbligatoria && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Obblig.</span>}
            </div>
          ))}
        </div>
      </Page>
    </div>
  );
}
