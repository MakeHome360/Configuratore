import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "../components/ui/button";
import { ArrowLeft, Printer, Mail, Sparkles, CheckCircle2, Award, Hammer, Wrench, FileText, Send } from "lucide-react";
import { fmtEuro, fmtNum } from "../editor/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

/**
 * Pagina di stampa preventivo: A4, carta intestata, design vendor-friendly.
 * Accessibile da /preventivi/:id/stampa o link diretto dal riepilogo.
 *
 * Funzionalità:
 * - Carta intestata con logo, ragione sociale, P.IVA, contatti
 * - Hero con cliente, numero, pacchetto scelto, totale evidenziato
 * - Breakdown trasparente (forfettario, no prezzi singoli per pacchetto)
 * - Sezione "perché scegliere il pacchetto" — copy emozionale di vendita
 * - Optional + bagni con dettaglio
 * - Termini di pagamento + validità preventivo
 * - Bottone STAMPA che apre window.print()
 *
 * Stile @media print: nasconde header, mostra A4 pulito.
 */
export default function PreventivoStampa() {
  const { id } = useParams();
  const nav = useNavigate();
  const [prev, setPrev] = useState(null);
  const [pkg, setPkg] = useState(null);
  const [bathroomTiers, setBathroomTiers] = useState([]);
  const [azienda, setAzienda] = useState({});
  const [loading, setLoading] = useState(true);

  const [incaricato, setIncaricato] = useState(null);
  const [emailSending, setEmailSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, packs, bt, az] = await Promise.all([
          api.get(`/preventivi/${id}`),
          api.get("/packages"),
          api.get("/packages/bathroom-tiers"),
          api.get("/dati-azienda"),
        ]);
        setPrev(p.data);
        setPkg((packs.data || []).find(x => x.id === p.data.package_id));
        setBathroomTiers(bt.data || []);
        setAzienda(az.data || {});
        // Carica anche l'utente "incaricato" che ha creato il preventivo
        if (p.data.user_id) {
          try {
            const u = await api.get(`/users/${p.data.user_id}`);
            setIncaricato(u.data);
          } catch {}
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [id]);

  const totals = useMemo(() => {
    if (!prev) return null;
    // ---- MODALITÀ COMPOSITE ----
    if (prev.tipo === "composite" || !pkg) {
      const compSel = prev.composite_selections || {};
      const voci_amount = Object.values(compSel).reduce((s, v) => s + (v.qty || 0) * (v.price || 0), 0);
      const m = parseFloat(prev.mq || 0);
      let multiplier = 1;
      if (m > 0 && m < 40) multiplier = 1.15;
      else if (m > 0 && m < 60) multiplier = 1.10;
      const voci_magg = voci_amount * multiplier;
      const infissi = (prev.infissi_extras || []).reduce((s, i) => s + ((i.qty || 0) * (i.unit_price || i.price || 0)), 0);
      const sic = voci_amount * ((prev.sicurezza_pct || 0) / 100);
      const dir = voci_amount * ((prev.direzione_lavori_pct || 0) / 100);
      const pre_sconto = voci_magg + infissi + sic + dir - (prev.sconto_eur || 0);
      const sconto_pct = pre_sconto * ((prev.sconto_pct || 0) / 100);
      const imponibile = pre_sconto - sconto_pct;
      const iva = imponibile * ((prev.iva_pct || 10) / 100);
      const total = imponibile + iva;
      return { mode: "composite", voci_amount, voci_magg, infissi, sic, dir, sconto_pct, imponibile, iva, total, multiplier };
    }
    // ---- MODALITÀ PACCHETTO (esistente) ----
    const mq = parseFloat(prev.mq || 0);
    let multiplier = 1, mq_eff = mq;
    if (mq < 40) { multiplier = 1.15; mq_eff = 40; }
    else if (mq < 60) multiplier = 1.10;
    const base = pkg.price_per_m2 * mq_eff * multiplier;
    const activeItems = (prev.items || []).filter(it => !it.excluded);
    const extras = activeItems.reduce((s, it) => {
      const incl = it.included_qty || 0;
      const reqs = Math.max(0, it.qty_richiesta || it.qty || 0);
      const unitPrice = Math.max(0, it.unit_price || 0);
      let extraVal = 0;
      if (incl === 0) extraVal = reqs * unitPrice;
      else {
        const extraQty = Math.max(0, reqs - incl);
        extraVal = extraQty * unitPrice;
        if (it.modificabile_dal_venditore) {
          const soglia = it.unit_price_pkg;
          if (soglia != null && soglia > 0 && unitPrice > soglia) extraVal += (unitPrice - soglia) * incl;
        }
      }
      return s + extraVal;
    }, 0);
    const optional = (prev.optional || []).reduce((s, o) => s + (o.total || 0), 0);
    const silverBase = (bathroomTiers && bathroomTiers[0]?.price) || 0;
    let bagno = 0;
    (prev.bathrooms || []).forEach(b => {
      const t = bathroomTiers.find(x => x.id === b.tier_id);
      if (!t) return;
      bagno += b.included ? Math.max(0, (t.price || 0) - silverBase) : (t.price || 0);
    });
    const subtotal = base + extras + optional + bagno;
    const sconto = subtotal * (prev.sconto_pct || 0) / 100;
    const after = subtotal - sconto;
    const iva = after * (prev.iva_pct || 10) / 100;
    const total = after + iva;
    return { mode: "pacchetto", base, extras, optional, bagno, subtotal, sconto, iva, total, multiplier, mq_eff };
  }, [prev, pkg, bathroomTiers]);

  if (loading) return <div className="p-12 text-center text-zinc-500">Caricamento…</div>;
  if (!prev) return <div className="p-12 text-center text-zinc-500">Preventivo non trovato.</div>;
  const isComposite = prev.tipo === "composite" || !prev.package_id;
  if (!isComposite && !pkg) return <div className="p-12 text-center text-zinc-500">Pacchetto non disponibile per questo preventivo.</div>;

  const dataDoc = prev.created_at ? new Date(prev.created_at).toLocaleDateString("it-IT", { year: "numeric", month: "long", day: "numeric" }) : new Date().toLocaleDateString("it-IT");
  const dataValidita = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("it-IT", { year: "numeric", month: "long", day: "numeric" });
  const colorePrimario = azienda.colore_primario || "#0F172A";
  // Helper per gradient sicuro: se il colore non è hex valido, usa fallback senza alpha
  const heroGradient = colorePrimario.startsWith("#")
    ? `linear-gradient(135deg, ${colorePrimario}, ${colorePrimario}dd)`
    : `linear-gradient(135deg, ${colorePrimario}, ${colorePrimario})`;

  return (
    <div className="min-h-screen bg-zinc-100">
      {/* Toolbar non-stampabile */}
      <div className="bg-zinc-900 text-white py-3 px-6 flex flex-wrap items-center justify-between gap-2 sticky top-0 z-10 print:hidden">
        <Button variant="ghost" className="text-white hover:bg-zinc-800" onClick={() => nav(-1)} data-testid="back-btn"><ArrowLeft className="h-4 w-4 mr-1" /> Torna al preventivo</Button>
        <div className="text-xs mono uppercase tracking-widest text-zinc-400">Anteprima stampa · {prev.numero}</div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-white/30 text-white bg-transparent hover:bg-white/10"
            disabled={emailSending || !prev.cliente?.email}
            onClick={async () => {
              if (!prev.cliente?.email) { toast.error("Il cliente non ha un indirizzo email"); return; }
              setEmailSending(true);
              try {
                const { data } = await api.post(`/preventivi/${id}/invia-email`, {});
                if (data?.ok) toast.success(`Email inviata a ${data.sent_to || prev.cliente.email}`);
                else toast.error(`Invio fallito: l'indirizzo "${data?.sent_to}" è rifiutato dal server SMTP (controlla il dominio)`);
              } catch (e) { toast.error("Errore invio: " + (e?.response?.data?.detail || e.message)); }
              setEmailSending(false);
            }}
            data-testid="email-send-btn"
            title={prev.cliente?.email ? `Invia al cliente: ${prev.cliente.email}` : "Inserisci email cliente"}
          >
            <Send className="h-4 w-4 mr-2" />
            {emailSending ? "Invio…" : "Invia al cliente"}
          </Button>
          <Button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700" data-testid="print-btn">
            <Printer className="h-4 w-4 mr-2" /> Stampa o PDF
          </Button>
        </div>
      </div>

      {/* Foglio A4 */}
      <div className="max-w-[210mm] mx-auto bg-white shadow-2xl my-6 print:shadow-none print:my-0 print:max-w-full" id="print-area">
        {/* ===== CARTA INTESTATA ===== */}
        <div className="px-12 pt-10 pb-6 border-b-4" style={{ borderColor: colorePrimario }}>
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              {azienda.logo ? (
                <img
                  src={azienda.logo}
                  alt="Logo"
                  className="h-16 w-auto"
                  data-testid="prev-stampa-logo"
                  onError={(e) => {
                    if (e.currentTarget.src.indexOf("/brand/sadicasa-light.png") === -1) {
                      e.currentTarget.src = "/brand/sadicasa-light.png";
                    } else {
                      e.currentTarget.style.display = "none";
                      const fb = e.currentTarget.nextElementSibling;
                      if (fb) fb.style.display = "flex";
                    }
                  }}
                />
              ) : (
                <img src="/brand/sadicasa-light.png" alt="Logo" className="h-16 w-auto" data-testid="prev-stampa-logo-default" />
              )}
              <div className="h-16 w-16 rounded-full items-center justify-center text-2xl font-bold text-white" style={{ background: colorePrimario, fontFamily: "Outfit", display: "none" }} data-testid="prev-stampa-logo-fallback">
                {(azienda.nome || "S")[0]}
              </div>
              <div>
                <div className="text-2xl font-bold" style={{ fontFamily: "Outfit", color: colorePrimario }}>{azienda.nome || "Sa di casa"}</div>
                {azienda.sito && <div className="text-xs text-zinc-500 mono">{azienda.sito}</div>}
              </div>
            </div>
            <div className="text-right text-xs text-zinc-600 leading-relaxed">
              {azienda.indirizzo && <div>{azienda.indirizzo}</div>}
              {azienda.telefono && <div>Tel: {azienda.telefono}</div>}
              {azienda.email && <div>{azienda.email}</div>}
              {azienda.piva && <div className="mono mt-1">P.IVA {azienda.piva}</div>}
            </div>
          </div>
        </div>

        {/* ===== TITOLO PREVENTIVO ===== */}
        <div className="px-12 py-6 bg-zinc-50">
          <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-500 mb-1">Proposta di ristrutturazione</div>
          <div className="flex items-end justify-between">
            <h1 className="text-4xl font-bold leading-tight" style={{ fontFamily: "Outfit", color: colorePrimario }}>Preventivo {prev.numero}</h1>
            <div className="text-right text-xs text-zinc-600">
              <div>Emesso il <strong>{dataDoc}</strong></div>
              <div>Valido fino al <strong>{dataValidita}</strong></div>
            </div>
          </div>
        </div>

        {/* ===== CLIENTE + IMMOBILE ===== */}
        <div className="px-12 py-6 grid grid-cols-2 gap-6 border-b border-zinc-200">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Spettabile cliente</div>
            <div className="text-lg font-semibold" style={{ fontFamily: "Outfit" }}>{prev.cliente?.nome} {prev.cliente?.cognome}</div>
            <div className="text-sm text-zinc-600">{prev.cliente?.indirizzo}</div>
            {prev.cliente?.email && <div className="text-xs text-zinc-500 mono">{prev.cliente.email}</div>}
            {prev.cliente?.telefono && <div className="text-xs text-zinc-500 mono">{prev.cliente.telefono}</div>}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">{isComposite ? "Tipo di preventivo" : "Pacchetto scelto"}</div>
            {isComposite ? (
              <div className="text-lg font-semibold flex items-center gap-2" style={{ fontFamily: "Outfit", color: colorePrimario }}>
                <Award className="h-5 w-5" /> Preventivo personalizzato
              </div>
            ) : (
              <div className="text-lg font-semibold flex items-center gap-2" style={{ fontFamily: "Outfit", color: pkg.color || colorePrimario }}>
                <Award className="h-5 w-5" /> {pkg.name}
              </div>
            )}
            <div className="text-sm text-zinc-600">{prev.mq} m²{!isComposite && ` · finitura ${pkg.tier || "completa"}`}</div>
            {(totals.multiplier !== 1) && (
              <div className="text-[10px] mono text-amber-700 mt-1">
                {prev.mq < 40 ? "Calcolo a corpo (mq < 40)" : "Maggiorazione mq piccole +10%"}
              </div>
            )}
          </div>
        </div>

        {/* ===== HERO TOTALE — il momento "wow" ===== */}
        <div className="px-12 py-10 text-center" style={{ background: heroGradient }}>
          <div className="text-[11px] uppercase tracking-[0.4em] text-white/70 mb-2">Investimento totale chiavi in mano</div>
          <div className="text-6xl font-bold text-white mono" style={{ fontFamily: "Outfit" }}>{fmtEuro(totals.total)}</div>
          <div className="text-xs text-white/80 mt-2">IVA inclusa al {prev.iva_pct || 10}% · Nessun costo nascosto</div>
          {totals.sconto > 0 && (
            <div className="inline-block mt-4 bg-emerald-500 text-white px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest">
              Sconto applicato {prev.sconto_pct}% ({fmtEuro(totals.sconto)})
            </div>
          )}
        </div>

        {/* ===== COSA È INCLUSO ===== */}
        <div className="px-12 py-8">
          <h2 className="text-2xl font-semibold mb-1" style={{ fontFamily: "Outfit", color: colorePrimario }}>
            {isComposite ? "Lavorazioni e voci selezionate" : `Cosa è incluso nel pacchetto ${pkg.name}`}
          </h2>
          <p className="text-sm text-zinc-600 mb-5">
            {isComposite
              ? "Le voci scelte voce per voce. Massima trasparenza: ogni lavorazione con la sua quantità e prezzo unitario."
              : <>Un'unica formula <strong>chiavi in mano</strong>: progettazione, lavori, materiali, finiture e assistenza durante e dopo i lavori. Trasparenza totale, prezzo bloccato.</>}
          </p>

          {!isComposite && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Pill icon={<Hammer className="h-4 w-4" />} title="Manodopera" desc="Tutte le lavorazioni edili comprese" />
            <Pill icon={<Wrench className="h-4 w-4" />} title="Impianti" desc="Idraulico, elettrico, riscaldamento" />
            <Pill icon={<Sparkles className="h-4 w-4" />} title="Finiture" desc={pkg.tier === "premium" ? "Premium di gamma alta" : "Di livello professionale"} />
            <Pill icon={<FileText className="h-4 w-4" />} title="Pratiche" desc="CILA/SCIA + capitolato" />
            <Pill icon={<CheckCircle2 className="h-4 w-4" />} title="Assistenza" desc="Project manager dedicato" />
            <Pill icon={<Award className="h-4 w-4" />} title="Chiavi in mano" desc="Un'unica formula completa" />
          </div>
          )}

          {/* LISTA LAVORAZIONI PER COMPOSITE */}
          {isComposite && (() => {
            const sel = prev.composite_selections || {};
            const voci = Object.values(sel).filter(v => v.qty > 0);
            const infissi = prev.infissi_extras || [];
            if (!voci.length && !infissi.length) return <p className="text-xs text-zinc-500 italic">Nessuna voce selezionata.</p>;
            return (
              <div className="border border-zinc-200 rounded">
                <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-200 text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">Lavorazioni e materiali</div>
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] uppercase tracking-widest text-zinc-500">
                    <tr><th className="text-left px-4 py-2">Voce</th><th className="text-right px-4 py-2">Qty</th><th className="text-right px-4 py-2">Prezzo</th><th className="text-right px-4 py-2">Totale</th></tr>
                  </thead>
                  <tbody>
                    {voci.map((v, i) => (
                      <tr key={i} className="border-b border-zinc-100 last:border-0">
                        <td className="px-4 py-1.5">{v.name || v.voce_name || v.id}</td>
                        <td className="px-4 py-1.5 text-right mono">{fmtNum(v.qty, 2)} {v.unit || ""}</td>
                        <td className="px-4 py-1.5 text-right mono text-zinc-500">{fmtEuro(v.price || 0)}</td>
                        <td className="px-4 py-1.5 text-right mono font-semibold">{fmtEuro((v.qty || 0) * (v.price || 0))}</td>
                      </tr>
                    ))}
                    {infissi.map((inf, i) => (
                      <tr key={`inf-${i}`} className="border-b border-zinc-100 last:border-0 bg-amber-50/30">
                        <td className="px-4 py-1.5">{inf.name || "Infisso"}</td>
                        <td className="px-4 py-1.5 text-right mono">{fmtNum(inf.qty || 1, 0)} {inf.unit || "pz"}</td>
                        <td className="px-4 py-1.5 text-right mono text-zinc-500">{fmtEuro(inf.unit_price || inf.price || 0)}</td>
                        <td className="px-4 py-1.5 text-right mono font-semibold">{fmtEuro((inf.qty || 1) * (inf.unit_price || inf.price || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* LISTA LAVORAZIONI PER PACCHETTO: prendi le voci dal PACCHETTO (template admin), poi sovrascrivi con quelle del preventivo se contengono name valido */}
          {!isComposite && (() => {
            const prevByVoce = {};
            (prev.items || []).forEach(it => { if (it.voce_id) prevByVoce[it.voce_id] = it; });
            const lavorazioni = (pkg.items || []).map(pi => {
              const fromPrev = prevByVoce[pi.voce_id];
              const name = pi.name || (fromPrev?.name && fromPrev.name !== "—" ? fromPrev.name : "Lavorazione");
              const mq = parseFloat(prev.mq || 0);
              const qty = fromPrev?.qty_richiesta != null ? fromPrev.qty_richiesta
                        : fromPrev?.qty != null ? fromPrev.qty
                        : (pi.qty_ratio ? Math.round(pi.qty_ratio * mq * 10) / 10 : null);
              const unit = pi.unit_consigliato || pi.unit || fromPrev?.unit || "";
              const excluded = fromPrev?.excluded;
              return { name, qty, unit, excluded, category: pi.category || "" };
            }).filter(x => !x.excluded);
            // Aggiungi anche eventuali "extra liberi" presenti nel preventivo che NON sono nel pacchetto
            (prev.items || []).filter(it => it.is_extra_free && !it.excluded).forEach(it => {
              lavorazioni.push({
                name: it.name || "Extra",
                qty: it.qty_richiesta || it.qty || 1,
                unit: it.unit || "pz",
                excluded: false,
                category: "EXTRA"
              });
            });
            // Estrae le categorie ordinate
            const cats = [...new Set(lavorazioni.map(l => l.category))];
            if (!lavorazioni.length) return null;
            return (
              <div className="border border-zinc-200 rounded mt-4">
                <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-200 text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">Lavorazioni eseguite (formula forfettaria)</div>
                <div className="px-4 py-3">
                  {cats.map(cat => (
                    <div key={cat} className="mb-3 last:mb-0">
                      {cat && <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-1.5">{cat}</div>}
                      <div className="grid grid-cols-2 gap-x-6 text-xs">
                        {lavorazioni.filter(l => l.category === cat).map((l, i) => (
                          <div key={i} className="py-1 flex items-baseline gap-2 border-b border-zinc-100 last:border-0">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                            <span className="flex-1">{l.name}</span>
                            {l.qty != null && <span className="mono text-[10px] text-zinc-500">{fmtNum(l.qty, 1)} {l.unit}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* ===== BAGNI ===== */}
        {!isComposite && (prev.bathrooms || []).length > 0 && (
          <div className="px-12 pb-8">
            <h3 className="text-lg font-semibold mb-3" style={{ fontFamily: "Outfit", color: colorePrimario }}>Configurazione bagni</h3>
            <div className="space-y-2">
              {(prev.bathrooms || []).map((b, i) => {
                const t = bathroomTiers.find(x => x.id === b.tier_id);
                return (
                  <div key={b.id} className="flex items-center gap-3 border border-zinc-200 px-4 py-3 rounded">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white" style={{ background: t?.color || colorePrimario }}>{i + 1}</div>
                    <div className="flex-1">
                      <div className="font-semibold">Bagno #{i + 1} — {t?.name || "Standard"}</div>
                      <div className="text-xs text-zinc-500">{t?.description || ""}</div>
                    </div>
                    <div className="text-[10px] mono uppercase tracking-widest text-zinc-500">{b.included ? "Incluso nel pacchetto" : "Aggiuntivo"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== OPTIONAL ===== */}
        {(prev.optional || []).length > 0 && (
          <div className="px-12 pb-8">
            <h3 className="text-lg font-semibold mb-3" style={{ fontFamily: "Outfit", color: colorePrimario }}>Optional aggiuntivi</h3>
            <table className="w-full text-sm">
              <tbody>
                {(prev.optional || []).map(o => (
                  <tr key={o.id} className="border-b border-zinc-100">
                    <td className="py-2 pl-2">
                      <div className="font-medium">{o.name}</div>
                      {o.descrizione && <div className="text-xs text-zinc-500">{o.descrizione}</div>}
                    </td>
                    <td className="py-2 text-right text-xs text-zinc-500 mono">{fmtNum(o.qty || 1, 1)} {o.unit || "pz"}</td>
                    <td className="py-2 text-right pr-2 mono font-semibold">{fmtEuro(o.total || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== BREAKDOWN TOTALI ===== */}
        <div className="px-12 pb-6">
          <div className="bg-zinc-50 border border-zinc-200 rounded p-5">
            <div className="space-y-2 text-sm">
              {isComposite ? (
                <>
                  <Row label="Voci selezionate" value={fmtEuro(totals.voci_amount)} />
                  {totals.multiplier !== 1 && <Row label={`Maggiorazione mq (×${totals.multiplier.toFixed(2)})`} value={`+ ${fmtEuro(totals.voci_magg - totals.voci_amount)}`} className="text-amber-700" />}
                  {totals.infissi > 0 && <Row label="Infissi" value={fmtEuro(totals.infissi)} />}
                  {totals.sic > 0 && <Row label={`Oneri sicurezza (${prev.sicurezza_pct || 0}%)`} value={fmtEuro(totals.sic)} />}
                  {totals.dir > 0 && <Row label={`Direzione lavori (${prev.direzione_lavori_pct || 0}%)`} value={fmtEuro(totals.dir)} />}
                  <div className="border-t border-zinc-300 pt-2 mt-2"><Row label="Imponibile" value={fmtEuro(totals.imponibile)} bold /></div>
                  {totals.sconto_pct > 0 && <Row label={`Sconto ${prev.sconto_pct}%`} value={`− ${fmtEuro(totals.sconto_pct)}`} className="text-emerald-700" />}
                  <Row label={`IVA ${prev.iva_pct || 10}%`} value={fmtEuro(totals.iva)} />
                </>
              ) : (
                <>
                  <Row label={`Base pacchetto ${pkg.name}`} value={fmtEuro(totals.base)} />
                  {totals.extras > 0 && <Row label="Extra lavorazioni" value={fmtEuro(totals.extras)} />}
                  {totals.optional > 0 && <Row label="Optional aggiuntivi" value={fmtEuro(totals.optional)} />}
                  {totals.bagno > 0 && <Row label={`Bagni aggiuntivi (${prev.bathrooms?.length || 0})`} value={fmtEuro(totals.bagno)} />}
                  <div className="border-t border-zinc-300 pt-2 mt-2"><Row label="Subtotale" value={fmtEuro(totals.subtotal)} bold /></div>
                  {totals.sconto > 0 && <Row label={`Sconto ${prev.sconto_pct}%`} value={`− ${fmtEuro(totals.sconto)}`} className="text-emerald-700" />}
                  <Row label={`IVA ${prev.iva_pct || 10}%`} value={fmtEuro(totals.iva)} />
                </>
              )}
              <div className="border-t-2 border-zinc-900 pt-3 mt-2">
                <div className="flex items-baseline justify-between">
                  <div className="text-base font-semibold uppercase tracking-widest" style={{ color: colorePrimario }}>Totale chiavi in mano</div>
                  <div className="mono text-3xl font-bold" style={{ color: colorePrimario }}>{fmtEuro(totals.total)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== PERCHÉ NOI (vendor closing) ===== */}
        <div className="px-12 py-6 bg-zinc-50">
          <h3 className="text-lg font-semibold mb-3" style={{ fontFamily: "Outfit", color: colorePrimario }}>Perché scegliere {azienda.nome || "noi"}</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Feature title="Prezzo bloccato" desc="Nessuna brutta sorpresa: il prezzo offerto è quello finale, IVA inclusa." />
            <Feature title="Project manager dedicato" desc="Un unico referente che segue il cantiere dall'inizio alla fine." />
            <Feature title="Materiali selezionati" desc="Forniture controllate e certificate dei nostri partner di fiducia." />
            <Feature title="Trasparenza totale" desc="Computo metrico dettagliato, SAL condivisi e foto cantiere in tempo reale." />
          </div>
        </div>

        {/* ===== TERMINI + NOTE ===== */}
        <div className="px-12 py-6 text-[10px] text-zinc-600 leading-relaxed">
          {(() => {
            const cp = (azienda.condizioni_pagamento || "").trim();
            if (cp) {
              const rows = cp.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
              return (
                <>
                  <h4 className="text-xs uppercase tracking-widest text-zinc-800 font-semibold mb-2">Termini di pagamento</h4>
                  <ul className="space-y-1 list-disc list-inside">
                    {rows.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                  <div className="mt-2 text-[10px] text-zinc-500 italic">Le condizioni di pagamento possono essere ridefinite di comune accordo con il cliente in sede di firma del contratto.</div>
                </>
              );
            }
            return (
              <>
                <h4 className="text-xs uppercase tracking-widest text-zinc-800 font-semibold mb-2">Termini di pagamento</h4>
                <div className="italic text-zinc-500">Le condizioni e le scadenze di pagamento verranno concordate direttamente con il cliente in fase di firma del contratto.</div>
              </>
            );
          })()}
          {prev.note && (<><h4 className="text-xs uppercase tracking-widest text-zinc-800 font-semibold mt-3 mb-1">Note del preventivo</h4><div className="italic">{prev.note}</div></>)}
          <p className="mt-3 text-zinc-500">Il preventivo ha validità di 30 giorni dalla data di emissione. Eventuali varianti in corso d'opera richiederanno integrazione scritta. Le quantità delle lavorazioni sono indicative e potranno essere riproporzionate in base ai rilievi finali del progetto esecutivo. Il presente documento ha natura di proposta commerciale e non costituisce contratto fino alla sottoscrizione delle parti.</p>
        </div>

        {/* ===== FOOTER CTA ===== */}
        <div className="px-12 py-8 border-t-4 print:hidden" style={{ borderColor: colorePrimario }}>
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Pronto per partire?</div>
            <div className="text-2xl font-semibold mb-3" style={{ fontFamily: "Outfit", color: colorePrimario }}>Confermiamo insieme il tuo nuovo spazio.</div>
            <p className="text-sm text-zinc-600 max-w-lg mx-auto mb-4">Conferma questo preventivo e fissiamo subito il sopralluogo tecnico per partire con il progetto esecutivo.</p>
            <div className="flex justify-center gap-3 flex-wrap">
              {azienda.telefono && <a href={`tel:${azienda.telefono}`} className="inline-block px-6 py-2.5 border-2 rounded text-sm font-semibold" style={{ borderColor: colorePrimario, color: colorePrimario }}>📞 {azienda.telefono}</a>}
              {azienda.email && (
                <a
                  href={`mailto:${azienda.email}?subject=Conferma preventivo ${prev.numero}&body=Buongiorno,%0D%0A%0D%0Aconfermo la mia accettazione del preventivo ${prev.numero}. Restiamo in attesa di vostre indicazioni per il sopralluogo e la firma del contratto.%0D%0A%0D%0ACordiali saluti,%0D%0A${encodeURIComponent((prev.cliente?.nome || "") + " " + (prev.cliente?.cognome || "")).trim()}`}
                  className="inline-block px-6 py-2.5 rounded text-sm font-semibold text-white" style={{ background: colorePrimario }}
                >
                  <Mail className="inline h-4 w-4 mr-1" /> Conferma via email
                </a>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 mt-3 italic">"Conferma via email" apre il tuo client di posta con un messaggio pre-compilato di accettazione. Puoi anche rispondere semplicemente alla nostra email allegando questo preventivo firmato.</p>
          </div>
        </div>

        {/* ===== FIRMA (per stampa) ===== */}
        <div className="px-12 py-6 border-t border-zinc-200 grid grid-cols-2 gap-12 text-xs">
          <div>
            <div className="border-b-2 border-zinc-300 pb-1 mb-1 h-12"></div>
            <div className="text-zinc-500">Per accettazione, il Cliente</div>
            <div className="font-semibold mt-1">{prev.cliente?.nome} {prev.cliente?.cognome}</div>
            <div className="text-zinc-400 text-[10px] mt-1">Data e firma</div>
          </div>
          <div>
            <div className="border-b-2 border-zinc-300 pb-1 mb-1 h-12"></div>
            <div className="text-zinc-500">Per {azienda.nome || "Azienda"}</div>
            <div className="font-semibold mt-1">{incaricato ? `${incaricato.name || ""}${incaricato.cognome ? " " + incaricato.cognome : ""}`.trim() || "L'incaricato" : "L'incaricato"}</div>
            {incaricato?.qualifica && <div className="text-[10px] text-zinc-500">{incaricato.qualifica}</div>}
            {incaricato?.email && <div className="text-[10px] mono text-zinc-500">{incaricato.email}</div>}
            <div className="text-zinc-400 text-[10px] mt-1">Timbro e firma</div>
          </div>
        </div>
      </div>

      {/* CSS print: nasconde toolbar, formatta A4 */}
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white !important; }
          #print-area { margin: 0 !important; box-shadow: none !important; max-width: none !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function Row({ label, value, bold = false, className = "" }) {
  return (
    <div className={`flex items-baseline justify-between ${className}`}>
      <div className={bold ? "font-semibold" : "text-zinc-600"}>{label}</div>
      <div className={`mono ${bold ? "font-bold" : ""}`}>{value}</div>
    </div>
  );
}

function Pill({ icon, title, desc }) {
  return (
    <div className="border border-zinc-200 p-3 rounded">
      <div className="flex items-center gap-2 mb-1 text-zinc-900">{icon} <span className="text-xs font-semibold uppercase tracking-wide">{title}</span></div>
      <div className="text-[11px] text-zinc-600 leading-snug">{desc}</div>
    </div>
  );
}

function Feature({ title, desc }) {
  return (
    <div className="flex gap-2">
      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
      <div><div className="font-semibold text-zinc-900 text-xs">{title}</div><div className="text-zinc-600">{desc}</div></div>
    </div>
  );
}
