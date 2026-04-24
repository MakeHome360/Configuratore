import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, Save } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

/**
 * Reusable CSV bulk import dialog.
 * props: endpoint (POST), header (csv header line example), example (csv row example), onClose, onSuccess
 */
export default function CsvImportDialog({ endpoint, header, example, onClose, onSuccess, title = "Importa CSV" }) {
  const [text, setText] = useState(`${header}\n${example}`);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const t = await f.text(); setText(t);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.post(endpoint, { csv: text, replace });
      toast.success(`${r.data.imported} righe importate`);
      onSuccess && onSuccess();
      onClose();
    } catch (e) { toast.error(e.response?.data?.detail || "Errore"); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-3">
          <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm">
            <strong>Formato CSV richiesto:</strong>
            <pre className="text-xs font-mono mt-1 p-2 bg-white rounded overflow-x-auto">{header}</pre>
            <strong>Esempio riga:</strong>
            <pre className="text-xs font-mono mt-1 p-2 bg-white rounded overflow-x-auto">{example}</pre>
          </div>
          <div>
            <input type="file" accept=".csv,.txt" onChange={onFile} data-testid="csv-file" className="text-sm" />
          </div>
          <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs" data-testid="csv-text" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} data-testid="csv-replace" />
            Sostituisci tutto (cancella i dati esistenti prima dell'import)
          </label>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={submit} disabled={busy} data-testid="csv-import-btn" style={{ background: "var(--brand)", color: "white" }}><Upload className="h-4 w-4 mr-2" />Importa</Button>
        </div>
      </div>
    </div>
  );
}
