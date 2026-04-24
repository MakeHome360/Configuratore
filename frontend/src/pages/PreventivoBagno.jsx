import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Page, PageHeader, fmtEur, fmtEur2 } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Save } from "lucide-react";
import { toast } from "sonner";

export default function PreventivoBagno() {
  const { id } = useParams();
  const isNew = !id;
  const nav = useNavigate();
  const [config, setConfig] = useState({ tiers: [], manodopera_base: 6500 });
  const [cliente, setCliente] = useState({ nome: "", telefono: "", email: "", indirizzo: "" });
  const [tier, setTier] = useState(null);
  const [piastrelleMq, setPiastrelleMq] = useState(0);
  const [piastrellePrezzo, setPiastrellePrezzo] = useState(0);
  const [extras, setExtras] = useState([]);
  const [sconto, setSconto] = useState(0);
  const [note, setNote] = useState("");
  const [ivaPct, setIvaPct] = useState(10);
  const [numero, setNumero] = useState(null);

  useEffect(() => {
    api.get("/bagno-config").then((r) => setConfig(r.data));
    if (!isNew) {
      api.get(`/preventivi/${id}`).then((r) => {
        const d = r.data;
        setCliente(d.cliente || {});
        setTier(d.bathroom_tier);
        setPiastrelleMq(d.piastrelle_mq || 0);
        setPiastrellePrezzo(d.piastrelle_prezzo_mq || 0);
        setExtras(d.extra_voci || []);
        setSconto(d.sconto_eur || 0);
        setNote(d.note || "");
        setIvaPct(d.iva_pct || 10);
        setNumero(d.numero);
      });
    }
  }, [id, isNew]);

  const tierPrice = useMemo(() => (config.tiers.find((t) => t.id === tier)?.price || 0), [tier, config]);
  const piastrelleTotal = (piastrelleMq || 0) * (piastrellePrezzo || 0);
  const extrasTotal = (extras || []).reduce((s, x) => s + (Number(x.prezzo) || 0) * (Number(x.qty) || 1), 0);
  const subtotal = (config.manodopera_base || 0) + tierPrice + piastrelleTotal + extrasTotal;
  const afterSconto = subtotal - (sconto || 0);
  const iva = afterSconto * (ivaPct / 100);
  const totale = afterSconto + iva;

  const save = async () => {
    if (!cliente.nome) return toast.error("Inserisci il nome cliente");
    const payload = {
      tipo: "bagno", cliente, package_id: null, mq: 0,
      manodopera_base: config.manodopera_base, bathroom_tier: tier,
      piastrelle_mq: piastrelleMq, piastrelle_prezzo_mq: piastrellePrezzo,
      extra_voci: extras, sconto_eur: sconto, note, iva_pct: ivaPct,
      totale_iva_incl: totale, totale_iva_escl: afterSconto,
    };
    try {
      if (isNew) {
        const { data } = await api.post("/preventivi", payload);
        toast.success("Preventivo salvato");
        nav(`/preventivobagno/${data.id}`, { replace: true });
      } else {
        await api.put(`/preventivi/${id}`, payload);
        toast.success("Aggiornato");
      }
    } catch { toast.error("Errore salvataggio"); }
  };

  return (
    <div>
      <PageHeader title="Preventivo Solo Bagno" subtitle="Ristrutturazione bagno chiavi in mano"
        actions={<div className="text-right"><div className="text-xs text-zinc-500">Totale IVA Inclusa</div><div className="text-2xl font-bold" data-testid="totale-bagno">{fmtEur2(totale)}</div></div>} />
      <Page>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <Section title="Dati Cliente">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome *"><Input value={cliente.nome} onChange={(e) => setCliente({ ...cliente, nome: e.target.value })} data-testid="bagno-nome" /></Field>
                <Field label="Telefono"><Input value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} /></Field>
                <Field label="Email"><Input value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} /></Field>
                <Field label="Indirizzo"><Input value={cliente.indirizzo} onChange={(e) => setCliente({ ...cliente, indirizzo: e.target.value })} /></Field>
              </div>
            </Section>

            <Section title="Manodopera Base">
              <div className="flex items-center justify-between p-3 bg-zinc-50 rounded">
                <div><div className="font-medium">Incluso materiali di consumo</div><div className="text-xs text-zinc-500">Fisso</div></div>
                <div className="font-bold">{fmtEur(config.manodopera_base)}</div>
              </div>
            </Section>

            <Section title="Pacchetto Sanitari">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {config.tiers.map((t) => (
                  <button key={t.id} onClick={() => setTier(t.id === tier ? null : t.id)}
                    data-testid={`bagno-tier-${t.id}`}
                    className={`text-left p-4 rounded-lg border-2 transition-all ${tier === t.id ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-400"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-bold text-lg" style={{ color: t.color }}>{t.name}</div>
                      <div className="font-bold">{fmtEur(t.price)}</div>
                    </div>
                    <div className="text-xs text-zinc-600 leading-snug">{t.description}</div>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Piastrelle">
              <div className="grid grid-cols-3 gap-3">
                <Field label="MQ Piastrelle"><Input type="number" value={piastrelleMq} onChange={(e) => setPiastrelleMq(Number(e.target.value))} /></Field>
                <Field label="Prezzo €/MQ"><Input type="number" value={piastrellePrezzo} onChange={(e) => setPiastrellePrezzo(Number(e.target.value))} /></Field>
                <Field label="Totale"><Input disabled value={fmtEur2(piastrelleTotal)} /></Field>
              </div>
            </Section>

            <Section title="Lavorazioni Extra" actions={<Button size="sm" variant="outline" onClick={() => setExtras([...extras, { nome: "", prezzo: 0, qty: 1 }])}><Plus className="h-3 w-3 mr-1" /> Aggiungi</Button>}>
              {extras.length === 0 && <div className="text-sm text-zinc-500 italic">Nessuna voce extra</div>}
              <div className="space-y-2">
                {extras.map((x, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <Input className="col-span-6" placeholder="Descrizione" value={x.nome} onChange={(e) => { const c = [...extras]; c[i].nome = e.target.value; setExtras(c); }} />
                    <Input className="col-span-2" type="number" placeholder="Prezzo" value={x.prezzo} onChange={(e) => { const c = [...extras]; c[i].prezzo = Number(e.target.value); setExtras(c); }} />
                    <Input className="col-span-2" type="number" placeholder="Qty" value={x.qty} onChange={(e) => { const c = [...extras]; c[i].qty = Number(e.target.value); setExtras(c); }} />
                    <div className="col-span-1 text-right font-mono text-sm">{fmtEur((x.prezzo || 0) * (x.qty || 1))}</div>
                    <button className="col-span-1 p-1 rounded hover:bg-rose-50" onClick={() => setExtras(extras.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-rose-600" /></button>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-4 bg-white border border-zinc-200 rounded-lg p-5 space-y-3">
              <h3 className="font-semibold text-zinc-900 pb-2 border-b border-zinc-200">Riepilogo</h3>
              <Row label="Manodopera Base" value={fmtEur(config.manodopera_base)} />
              {tier && <Row label={config.tiers.find(t => t.id === tier)?.name} value={fmtEur(tierPrice)} />}
              {piastrelleTotal > 0 && <Row label="Piastrelle" value={fmtEur(piastrelleTotal)} />}
              {extrasTotal > 0 && <Row label="Extra" value={fmtEur(extrasTotal)} />}
              <Row label="Totale IVA Esclusa" value={fmtEur2(subtotal)} bold />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Sconto €"><Input type="number" value={sconto} onChange={(e) => setSconto(Number(e.target.value))} /></Field>
                <Field label="IVA %"><Input type="number" value={ivaPct} onChange={(e) => setIvaPct(Number(e.target.value))} /></Field>
              </div>
              <Row label="TOTALE IVA INCLUSA" value={fmtEur2(totale)} bold big />
              <Field label="Note"><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} /></Field>
              <Button className="w-full" onClick={save} data-testid="bagno-save" style={{ background: "var(--brand)", color: "white" }}>
                <Save className="h-4 w-4 mr-2" /> Salva Preventivo
              </Button>
              {numero && <div className="text-xs text-center text-zinc-500">{numero}</div>}
            </div>
          </div>
        </div>
      </Page>
    </div>
  );
}

const Section = ({ title, children, actions }) => (
  <div className="bg-white border border-zinc-200 rounded-lg p-4">
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-semibold text-zinc-900">{title}</h3>
      {actions}
    </div>
    {children}
  </div>
);
const Field = ({ label, children }) => <div><Label className="text-xs text-zinc-600">{label}</Label><div className="mt-1">{children}</div></div>;
const Row = ({ label, value, bold, big }) => (
  <div className={`flex items-center justify-between ${bold ? "font-bold" : ""} ${big ? "text-lg pt-2 border-t border-zinc-200" : "text-sm"}`}>
    <span>{label}</span><span>{value}</span>
  </div>
);
