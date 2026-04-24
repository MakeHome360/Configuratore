import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Page, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Save } from "lucide-react";
import { toast } from "sonner";

export default function AdminTemplateEmail() {
  const [rows, setRows] = useState([]);
  const [sel, setSel] = useState(null);
  const load = () => api.get("/template-email").then((r) => setRows(r.data || []));
  useEffect(() => { load(); }, []);
  const save = async () => { await api.put(`/template-email/${sel.id}`, { subject: sel.subject, body: sel.body }); toast.success("Salvato"); load(); };

  return (
    <div>
      <PageHeader title="Template Email" subtitle="Gestisci i template di notifica automatiche" />
      <Page>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            {rows.map((t) => (
              <button key={t.id} onClick={() => setSel(t)} data-testid={`tmpl-${t.code}`}
                className={`w-full text-left p-3 border rounded-lg ${sel?.id === t.id ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-400"}`}>
                <div className="flex items-center gap-2 mb-1"><Mail className="h-4 w-4 text-zinc-500" /><span className="font-mono text-xs">{t.code}</span></div>
                <div className="text-xs text-zinc-500">{t.trigger} · {t.recipient}</div>
                <div className="text-sm font-medium mt-1 line-clamp-1">{t.subject}</div>
              </button>
            ))}
          </div>
          <div className="col-span-2 bg-white border border-zinc-200 rounded-lg p-5">
            {sel ? (
              <div className="space-y-3">
                <div className="text-xs font-mono text-zinc-500">{sel.code}</div>
                <div><Label>Oggetto</Label><Input value={sel.subject} onChange={(e) => setSel({ ...sel, subject: e.target.value })} data-testid="tmpl-subject" /></div>
                <div><Label>Corpo email</Label><Textarea rows={12} value={sel.body} onChange={(e) => setSel({ ...sel, body: e.target.value })} /></div>
                <div className="text-xs text-zinc-500">Variabili disponibili: <span className="font-mono">{"{{cliente_nome}}, {{indirizzo}}, {{mq}}, {{pacchetto}}, {{totale}}, {{nome_voce}}"}</span></div>
                <Button onClick={save} data-testid="tmpl-save" style={{ background: "var(--brand)", color: "white" }}><Save className="h-4 w-4 mr-2" />Salva</Button>
              </div>
            ) : <div className="text-zinc-500 text-center py-12">Seleziona un template</div>}
          </div>
        </div>
      </Page>
    </div>
  );
}
