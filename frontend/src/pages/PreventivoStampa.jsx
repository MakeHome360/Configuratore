import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { ArrowLeft, Printer, Mail, Sparkles, CheckCircle2, Award, Hammer, Wrench, FileText, Send } from "lucide-react";
import html2pdf from "html2pdf.js";
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
  // R87: Dialog email composer (sostituisce window.prompt che è bloccato su Safari/iPad)
  const [emailDialog, setEmailDialog] = useState({ open: false, destinatario: "", messaggio: "" });

  useEffect(() => {
    (async () => {
      try {
        const [p, packs, bt, az, imp] = await Promise.all([
          api.get(`/preventivi/${id}`),
          api.get("/packages"),
          api.get("/packages/bathroom-tiers"),
          api.get("/dati-azienda").catch(() => ({ data: {} })),
          api.get("/impostazioni").catch(() => ({ data: {} })),
        ]);
        setPrev(p.data);
        setPkg((packs.data || []).find(x => x.id === p.data.package_id));
        setBathroomTiers(bt.data || []);
        // Merge impostazioni (Round 81+) sopra dati-azienda (legacy).
        // Mappa: marchio_commerciale → nome, partita_iva → piva, telefono_principale → telefono, email_principale → email,
        // ricostruisce indirizzo da sede legale, espone sedi_operative + ragione_sociale + codice_fiscale + rea + pec.
        const i = imp.data || {};
        const a = az.data || {};
        const sedeIndirizzo = [
          i.sede_legale_indirizzo,
          i.sede_legale_cap, i.sede_legale_citta,
          i.sede_legale_provincia ? `(${i.sede_legale_provincia})` : null,
        ].filter(Boolean).join(" ").trim();
        const merged = {
          ...a,
          nome: i.marchio_commerciale || a.nome || a.marchio || "",
          ragione_sociale: i.ragione_sociale || a.ragione_sociale || "",
          piva: i.partita_iva || a.piva || a.partita_iva || "",
          codice_fiscale: i.codice_fiscale || a.codice_fiscale || "",
          rea: i.rea || a.rea || "",
          pec: i.pec || a.pec || "",
          indirizzo: sedeIndirizzo || a.indirizzo || "",
          telefono: i.telefono_principale || a.telefono || "",
          email: i.email_principale || a.email || "",
          sito: i.sito || a.sito || "",
          logo: i.logo || a.logo || "",
          colore_primario: i.colore_primario || a.colore_primario || a.colorePrimario || "#0F172A",
          sedi_operative: i.sedi_operative || a.sedi_operative || [],
          condizioni_pagamento: i.condizioni_pagamento || a.condizioni_pagamento || "",
        };
        setAzienda(merged);
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
    // ---- MODALITÀ BAGNO (R89) ----
    if (prev.tipo === "bagno") {
      const manodopera = Number(prev.manodopera_base || 0);
      const tier = (bathroomTiers || []).find((t) => t.id === prev.bathroom_tier);
      const tierPrice = tier?.price || 0;
      const piastrelleTot = (Number(prev.piastrelle_mq || 0)) * (Number(prev.piastrelle_prezzo_mq || 0));
      const extrasTot = (prev.extra_voci || []).reduce((s, x) => s + (Number(x.prezzo) || 0) * (Number(x.qty) || 1), 0);
      const subtotal = manodopera + tierPrice + piastrelleTot + extrasTot;
      const sconto = Number(prev.sconto_eur || 0);
      const after = subtotal - sconto;
      const iva = after * ((prev.iva_pct || 10) / 100);
      const total = after + iva;
      return {
        mode: "bagno", manodopera, tier, tierPrice, piastrelleTot, extrasTot,
        subtotal, sconto, imponibile: after, iva, total, multiplier: 1,
      };
    }
    // ---- MODALITÀ COMPOSITE ----
    if (prev.tipo === "composite" || !pkg) {
      const compSel = prev.composite_selections || {};
      const voci_amount = Object.values(compSel).reduce((s, v) => s + (v.qty || 0) * (v.price || 0), 0);
      // 🛒 Prodotti da Listini Fornitori
      const listini_amount = (prev.listini_selections || []).reduce(
        (s, p) => s + ((parseFloat(p.qty) || 0) * (parseFloat(p.prezzo_rivendita) || 0)),
        0
      );
      // ✋ Voci extra manuali (Round 86)
      const manual_amount = (prev.manual_extras || []).reduce(
        (s, m) => s + ((Number(m.qty) || 0) * (Number(m.price) || 0)),
        0
      );
      const base = voci_amount + listini_amount + manual_amount;
      const m = parseFloat(prev.mq || 0);
      let multiplier = 1;
      if (m > 0 && m < 40) multiplier = 1.15;
      else if (m > 0 && m < 60) multiplier = 1.10;
      const voci_magg = base * multiplier;
      const infissi = (prev.infissi_extras || []).reduce((s, i) => s + ((i.qty || 0) * (i.unit_price || i.price || 0)), 0);
      const sic = base * ((prev.sicurezza_pct || 0) / 100);
      const dir = base * ((prev.direzione_lavori_pct || 0) / 100);
      const pre_sconto = voci_magg + infissi + sic + dir - (prev.sconto_eur || 0);
      const sconto_pct = pre_sconto * ((prev.sconto_pct || 0) / 100);
      const imponibile = pre_sconto - sconto_pct;
      const iva = imponibile * ((prev.iva_pct || 10) / 100);
      const total = imponibile + iva;
      // R87: se il preventivo è stato ricostruito da audit/snapshot e le voci dettagliate sono
      // vuote ma il totale salvato è valido, usiamo IL VALORE SALVATO come fonte autorevole.
      const savedTotal = Number(prev.totale_iva_incl || 0);
      const restored = prev.ricostruito_da_audit || prev.ripristinato_da_snapshot;
      const useSaved = (restored || total === 0) && savedTotal > 0;
      return {
        mode: "composite",
        voci_amount, listini_amount, manual_amount, voci_magg, infissi, sic, dir,
        sconto_pct, imponibile: useSaved ? (savedTotal / (1 + (prev.iva_pct || 10) / 100)) : imponibile,
        iva: useSaved ? (savedTotal - savedTotal / (1 + (prev.iva_pct || 10) / 100)) : iva,
        total: useSaved ? savedTotal : total,
        multiplier,
        usingSavedTotal: useSaved,
      };
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
  const isComposite = prev.tipo === "composite" || (!prev.package_id && prev.tipo !== "bagno");
  const isBagno = prev.tipo === "bagno";
  if (!isComposite && !isBagno && !pkg) return <div className="p-12 text-center text-zinc-500">Pacchetto non disponibile per questo preventivo.</div>;

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
            disabled={emailSending}
            onClick={() => {
              // R87: apri dialog vero (Safari/iPad blocca window.prompt silenziosamente)
              setEmailDialog({
                open: true,
                destinatario: (prev.cliente?.email || "").trim(),
                messaggio: "",
              });
            }}
            data-testid="email-send-btn"
            title="Apri compositore email"
          >
            <Send className="h-4 w-4 mr-2" />
            {emailSending ? "Invio…" : "Invia al cliente"}
          </Button>
          <Button onClick={async () => {
            // R89 quater: PDF download compatibile iOS Safari.
            // TRUCCO iOS: window.open() DEVE essere chiamato sincronicamente nel click handler
            // (user gesture), altrimenti Safari blocca la nuova tab. Poi popolo la URL con il blob.
            const node = document.getElementById("print-area");
            if (!node) { toast.error("Errore: area di stampa non trovata"); return; }
            const filename = `Preventivo_${prev.numero || id}_${(prev.cliente?.nome || "cliente").replace(/\s+/g, "_")}.pdf`;
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

            // Su iOS apro subito la nuova tab (about:blank) come user gesture — evita popup blocker
            let popupWin = null;
            if (isIOS) {
              popupWin = window.open("", "_blank");
              if (popupWin && popupWin.document) {
                popupWin.document.write(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${filename}</title><style>body{margin:0;font-family:-apple-system,sans-serif;background:#f4f4f5;color:#18181b;text-align:center;padding:40px 20px}.wrap{max-width:400px;margin:0 auto;background:white;padding:30px 24px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.1)}.spinner{width:44px;height:44px;border:4px solid #e4e4e7;border-top-color:#14b8a6;border-radius:50%;animation:s 1s linear infinite;margin:0 auto 16px}@keyframes s{to{transform:rotate(360deg)}}h1{font-size:18px;margin:0 0 8px}p{font-size:14px;color:#71717a;margin:4px 0}</style></head><body><div class="wrap"><div class="spinner"></div><h1>Generazione PDF in corso…</h1><p>Attendi qualche secondo</p><p style="font-size:12px;margin-top:14px">${filename}</p></div></body></html>`);
              }
            }

            toast.info("Generazione PDF in corso (5-10 sec)…");
            try {
              const opt = {
                filename,
                margin: 0,
                image: { type: "jpeg", quality: 0.95 },
                html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" },
                jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
                pagebreak: { mode: ["css", "legacy"] },
              };
              if (isIOS) {
                const blob = await html2pdf().set(opt).from(node).outputPdf("blob");
                const url = URL.createObjectURL(blob);
                if (popupWin && !popupWin.closed) {
                  // Sostituisco lo spinner con il PDF vero
                  popupWin.location.href = url;
                  toast.success("PDF pronto nella nuova scheda. Tap su Condividi → Salva su File.", { duration: 8000 });
                } else {
                  // Fallback: popup bloccato — mostro anchor visibile
                  const linkId = `pdf-download-${Date.now()}`;
                  const container = document.createElement("div");
                  container.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px";
                  container.innerHTML = `<div style="background:white;padding:24px;border-radius:12px;max-width:340px;text-align:center;font-family:-apple-system,sans-serif"><div style="font-size:16px;font-weight:600;margin-bottom:12px">PDF pronto</div><p style="font-size:13px;color:#71717a;margin-bottom:18px">Il tuo browser ha bloccato la nuova scheda. Tap sul bottone qui sotto per aprire il PDF.</p><a id="${linkId}" href="${url}" target="_blank" download="${filename}" style="display:block;background:#059669;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;margin-bottom:10px">Apri PDF</a><button id="${linkId}-close" style="background:transparent;border:1px solid #e4e4e7;padding:8px 16px;border-radius:8px;color:#71717a;cursor:pointer">Annulla</button></div>`;
                  document.body.appendChild(container);
                  document.getElementById(`${linkId}-close`).onclick = () => container.remove();
                }
              } else {
                await html2pdf().set(opt).from(node).save();
                toast.success(`PDF "${filename}" scaricato nei tuoi Download`);
              }
            } catch (e) {
              if (popupWin && !popupWin.closed) popupWin.close();
              toast.error("Errore generazione PDF: " + e.message);
            }
          }} className="bg-emerald-600 hover:bg-emerald-700" data-testid="print-btn">
            <Printer className="h-4 w-4 mr-2" /> Scarica PDF
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
                <div className="text-2xl font-bold" style={{ fontFamily: "Outfit", color: colorePrimario }} data-testid="prev-stampa-marchio">{azienda.nome || "Sa di casa"}</div>
                {azienda.ragione_sociale && (
                  <div className="text-[11px] text-zinc-600 mt-0.5" data-testid="prev-stampa-ragione-sociale">{azienda.ragione_sociale}</div>
                )}
                {azienda.sito && <div className="text-xs text-zinc-500 mono">{azienda.sito}</div>}
              </div>
            </div>
            <div className="text-right text-xs text-zinc-600 leading-relaxed" data-testid="prev-stampa-azienda-dati">
              {azienda.indirizzo && <div data-testid="prev-stampa-sede">{azienda.indirizzo}</div>}
              {azienda.telefono && <div>Tel: {azienda.telefono}</div>}
              {azienda.email && <div>{azienda.email}</div>}
              {azienda.pec && <div className="mono">PEC: {azienda.pec}</div>}
              {azienda.piva && <div className="mono mt-1" data-testid="prev-stampa-piva">P.IVA {azienda.piva}</div>}
              {azienda.codice_fiscale && azienda.codice_fiscale !== azienda.piva && (
                <div className="mono" data-testid="prev-stampa-cf">C.F. {azienda.codice_fiscale}</div>
              )}
              {azienda.rea && <div className="mono">REA: {azienda.rea}</div>}
            </div>
          </div>
          {/* Sedi operative (Round 86) */}
          {Array.isArray(azienda.sedi_operative) && azienda.sedi_operative.length > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-200 flex flex-wrap gap-x-6 gap-y-1 text-[10px] text-zinc-500" data-testid="prev-stampa-sedi-operative">
              <span className="uppercase tracking-widest font-semibold">Sedi operative:</span>
              {azienda.sedi_operative.map((s, i) => (
                <span key={s.id || i} data-testid={`prev-stampa-sede-op-${i}`}>
                  <strong className="text-zinc-700">{s.nome}</strong>
                  {s.indirizzo ? ` — ${s.indirizzo}` : ""}
                  {s.citta ? `, ${s.citta}` : ""}
                  {s.cap ? ` ${s.cap}` : ""}
                  {s.telefono ? ` · tel ${s.telefono}` : ""}
                </span>
              ))}
            </div>
          )}
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
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">{isComposite ? "Tipo di preventivo" : (isBagno ? "Tipo di preventivo" : "Pacchetto scelto")}</div>
            {isBagno ? (
              <div className="text-lg font-semibold flex items-center gap-2" style={{ fontFamily: "Outfit", color: totals.tier?.color || colorePrimario }}>
                <Award className="h-5 w-5" /> Ristrutturazione Bagno{totals.tier ? ` · ${totals.tier.name}` : ""}
              </div>
            ) : isComposite ? (
              <div className="text-lg font-semibold flex items-center gap-2" style={{ fontFamily: "Outfit", color: colorePrimario }}>
                <Award className="h-5 w-5" /> Preventivo personalizzato
              </div>
            ) : (
              <div className="text-lg font-semibold flex items-center gap-2" style={{ fontFamily: "Outfit", color: pkg.color || colorePrimario }}>
                <Award className="h-5 w-5" /> {pkg.name}
              </div>
            )}
            <div className="text-sm text-zinc-600">
              {isBagno ? "Chiavi in mano" : (<>{prev.mq} m²{!isComposite && ` · finitura ${pkg.tier || "completa"}`}</>)}
            </div>
            {(totals.multiplier !== 1) && !isBagno && (
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

        {/* R87: banner rimosso — nascosto completamente all'utente.
           L'avviso restore è visibile solo nella lista Preventivi (badge admin). */}

        {/* ===== BAGNO BREAKDOWN (R89) ===== */}
        {isBagno && (
          <div className="px-12 py-8">
            <h2 className="text-2xl font-semibold mb-1" style={{ fontFamily: "Outfit", color: colorePrimario }}>
              Ristrutturazione bagno chiavi in mano
            </h2>
            <p className="text-sm text-zinc-600 mb-5">
              Formula tutto-compreso: manodopera, materiali, sanitari, rubinetterie, piastrelle e finiture.
            </p>
            <div className="border border-zinc-200 rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] uppercase tracking-widest text-zinc-500">
                  <tr>
                    <th className="text-left px-4 py-2">Descrizione</th>
                    <th className="text-right px-4 py-2 w-32">Totale</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-zinc-100">
                    <td className="px-4 py-3">
                      <div className="font-semibold">Manodopera base bagno</div>
                      <div className="text-[11px] text-zinc-500">
                        Include: demolizione bagno, impianto idraulico/elettrico, massetto e impermeabilizzazione,
                        posa piastrelle, pittura pareti/soffitto, installazione sanitari e miscelatori,
                        smaltimento macerie.
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{fmtEuro(totals.manodopera)}</td>
                  </tr>
                  {totals.tier && (
                    <tr className="border-b border-zinc-100">
                      <td className="px-4 py-3">
                        <div className="font-semibold" style={{ color: totals.tier.color }}>
                          Pacchetto sanitari · {totals.tier.name}
                        </div>
                        <div className="text-[11px] text-zinc-500 mb-1">{totals.tier.description}</div>
                        {(totals.tier.included_items || []).length > 0 && (
                          <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1">
                            {(totals.tier.included_items || []).map((it, i) => (
                              <li key={i} className="text-[10px] text-zinc-700 flex items-start gap-1">
                                <span className="text-emerald-500 mt-0.5">✓</span><span>{it}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{fmtEuro(totals.tierPrice)}</td>
                    </tr>
                  )}
                  {totals.piastrelleTot > 0 && (
                    <tr className="border-b border-zinc-100">
                      <td className="px-4 py-3">
                        <div className="font-semibold">Piastrelle</div>
                        <div className="text-[11px] text-zinc-500">
                          {prev.piastrelle_mq} m² × {fmtEuro(prev.piastrelle_prezzo_mq)}/m²
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{fmtEuro(totals.piastrelleTot)}</td>
                    </tr>
                  )}
                  {(prev.extra_voci || []).map((x, i) => (
                    (Number(x.prezzo) || 0) * (Number(x.qty) || 1) > 0 ? (
                      <tr key={i} className="border-b border-zinc-100">
                        <td className="px-4 py-3">
                          <div className="font-semibold">{x.nome || `Extra ${i + 1}`}</div>
                          {x.qty > 1 && <div className="text-[11px] text-zinc-500">Qty: {x.qty} × {fmtEuro(x.prezzo)}</div>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{fmtEuro((Number(x.prezzo) || 0) * (Number(x.qty) || 1))}</td>
                      </tr>
                    ) : null
                  ))}
                  <tr className="bg-zinc-50 font-semibold">
                    <td className="px-4 py-2 text-right">Subtotale (IVA esclusa)</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtEuro(totals.subtotal)}</td>
                  </tr>
                  {totals.sconto > 0 && (
                    <tr className="bg-emerald-50 text-emerald-700 font-semibold">
                      <td className="px-4 py-2 text-right">Sconto commerciale</td>
                      <td className="px-4 py-2 text-right font-mono">− {fmtEuro(totals.sconto)}</td>
                    </tr>
                  )}
                  <tr className="border-t border-zinc-200">
                    <td className="px-4 py-2 text-right text-[11px] text-zinc-500">Imponibile</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtEuro(totals.imponibile)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-right text-[11px] text-zinc-500">IVA {prev.iva_pct || 10}%</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtEuro(totals.iva)}</td>
                  </tr>
                  <tr className="bg-zinc-900 text-white font-bold text-base">
                    <td className="px-4 py-3 text-right">TOTALE CHIAVI IN MANO</td>
                    <td className="px-4 py-3 text-right font-mono">{fmtEuro(totals.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== COSA È INCLUSO ===== */}
        {!isBagno && (
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
            const listini = (prev.listini_selections || []).filter(p => (parseFloat(p.qty) || 0) > 0);
            const manuali = (prev.manual_extras || []).filter(m => (Number(m.qty) || 0) > 0);
            const infissi = prev.infissi_extras || [];
            if (!voci.length && !listini.length && !manuali.length && !infissi.length) return <p className="text-xs text-zinc-500 italic">Nessuna voce selezionata.</p>;
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
                        <td className="px-4 py-1.5">
                          {v.name || v.voce_name || v.id}
                          {v.product_nome && <span className="text-[10px] text-zinc-500 ml-1">— {v.product_nome}{v.product_fornitore ? ` (${v.product_fornitore})` : ""}</span>}
                        </td>
                        <td className="px-4 py-1.5 text-right mono">{fmtNum(v.qty, 2)} {v.unit || ""}</td>
                        <td className="px-4 py-1.5 text-right mono text-zinc-500">{fmtEuro(v.price || 0)}</td>
                        <td className="px-4 py-1.5 text-right mono font-semibold">{fmtEuro((v.qty || 0) * (v.price || 0))}</td>
                      </tr>
                    ))}
                    {listini.map((p, i) => (
                      <tr key={`lst-${i}`} className="border-b border-zinc-100 last:border-0 bg-blue-50/30" data-testid={`prev-stampa-listino-${i}`}>
                        <td className="px-4 py-1.5">
                          {p.nome || p.name || "Prodotto"}
                          {p.fornitore_nome && <span className="text-[10px] text-zinc-500 ml-1">— {p.fornitore_nome}</span>}
                          {p.codice && <span className="text-[10px] text-zinc-400 ml-1 mono">[{p.codice}]</span>}
                        </td>
                        <td className="px-4 py-1.5 text-right mono">{fmtNum(p.qty || 0, 2)} {p.unit || ""}</td>
                        <td className="px-4 py-1.5 text-right mono text-zinc-500">{fmtEuro(parseFloat(p.prezzo_rivendita) || 0)}</td>
                        <td className="px-4 py-1.5 text-right mono font-semibold">{fmtEuro((parseFloat(p.qty) || 0) * (parseFloat(p.prezzo_rivendita) || 0))}</td>
                      </tr>
                    ))}
                    {manuali.map((m, i) => (
                      <tr key={`man-${i}`} className="border-b border-zinc-100 last:border-0" data-testid={`prev-stampa-manual-${i}`}>
                        <td className="px-4 py-1.5">
                          {m.name || "Voce extra"}
                          {m.category && m.category !== "EXTRA" && <span className="text-[10px] text-zinc-500 ml-1">— {m.category}</span>}
                        </td>
                        <td className="px-4 py-1.5 text-right mono">{fmtNum(m.qty || 0, 2)} {m.unit || ""}</td>
                        <td className="px-4 py-1.5 text-right mono text-zinc-500">{fmtEuro(Number(m.price) || 0)}</td>
                        <td className="px-4 py-1.5 text-right mono font-semibold">{fmtEuro((Number(m.qty) || 0) * (Number(m.price) || 0))}</td>
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
        )}

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
        {!isBagno && (
        <div className="px-12 pb-6">
          <div className="bg-zinc-50 border border-zinc-200 rounded p-5">
            <div className="space-y-2 text-sm">
              {isComposite ? (
                <>
                  <Row label="Voci selezionate" value={fmtEuro(totals.voci_amount)} />
                  {totals.listini_amount > 0 && <Row label="Prodotti da listini fornitori" value={fmtEuro(totals.listini_amount)} />}
                  {totals.manual_amount > 0 && <Row label="Voci extra manuali" value={fmtEuro(totals.manual_amount)} className="text-emerald-700" />}
                  {totals.multiplier !== 1 && <Row label={`Maggiorazione mq (×${totals.multiplier.toFixed(2)})`} value={`+ ${fmtEuro(totals.voci_magg - (totals.voci_amount + totals.listini_amount + totals.manual_amount))}`} className="text-amber-700" />}
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
        )}

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

          {/* Clausola legale "oggetto del preventivo" — richiesta utente */}
          <div className="mt-4 border-2 border-zinc-900 rounded p-3 bg-amber-50" data-testid="prev-stampa-clausola-oggetto">
            <div className="text-[10px] uppercase tracking-widest text-zinc-700 font-bold mb-1">⚠ Oggetto del preventivo</div>
            <p className="text-xs text-zinc-900 font-semibold leading-snug">
              Il presente preventivo comprende <strong>esclusivamente le opere e le lavorazioni espressamente indicate nelle sezioni precedenti</strong>.
              Qualsiasi opera, lavorazione, fornitura o servizio <strong>non specificamente menzionato</strong> nel presente documento
              <strong> non sarà considerato oggetto dello stesso</strong> e, se richiesto in corso d'opera, sarà oggetto di separato preventivo
              integrativo da concordare e firmare prima dell'esecuzione.
            </p>
          </div>

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
            <div className="text-zinc-500">Per {azienda.ragione_sociale || azienda.nome || "Azienda"}</div>
            {azienda.ragione_sociale && azienda.nome && azienda.nome !== azienda.ragione_sociale && (
              <div className="text-[10px] text-zinc-400">(marchio commerciale: {azienda.nome})</div>
            )}
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

      {/* R87: Dialog compositore email (sostituisce window.prompt bloccato su Safari/iPad) */}
      <Dialog open={emailDialog.open} onOpenChange={(o) => setEmailDialog((d) => ({ ...d, open: o }))}>
        <DialogContent className="max-w-lg print:hidden" data-testid="email-dialog">
          <DialogHeader>
            <DialogTitle>📧 Invia preventivo {prev.numero} al cliente</DialogTitle>
            <DialogDescription>
              L'email arriverà al cliente con il riepilogo completo e il link al preventivo stampabile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-[11px] text-blue-900 leading-snug">
              ℹ️ <strong>Importante</strong>: dopo l'invio, suggerisci al cliente di <strong>controllare la cartella SPAM/Posta indesiderata</strong>.
              Aruba (il nostro provider SMTP) viene spesso filtrato da Gmail e Outlook365.
              Se ricorrente, valuta di passare a Resend/SendGrid (chiedi all'assistenza).
            </div>
            <div>
              <Label htmlFor="dest-email" className="text-xs uppercase tracking-widest">Email destinatario *</Label>
              <Input
                id="dest-email"
                type="email"
                value={emailDialog.destinatario}
                onChange={(e) => setEmailDialog((d) => ({ ...d, destinatario: e.target.value }))}
                placeholder="cliente@example.com"
                className="rounded-sm h-10 mt-1"
                data-testid="email-dialog-destinatario"
                autoFocus={!emailDialog.destinatario}
              />
              {prev.cliente?.nome && (
                <div className="text-[11px] text-zinc-500 mt-1">
                  Cliente: <strong>{prev.cliente.nome}{prev.cliente.cognome ? " " + prev.cliente.cognome : ""}</strong>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="msg-email" className="text-xs uppercase tracking-widest">Messaggio personalizzato (opzionale)</Label>
              <Textarea
                id="msg-email"
                rows={4}
                value={emailDialog.messaggio}
                onChange={(e) => setEmailDialog((d) => ({ ...d, messaggio: e.target.value }))}
                placeholder="Es: Come concordato nel sopralluogo del 25/05, includo la maggiorazione per il piano alto e lo smaltimento mobilio antico."
                className="rounded-sm mt-1 text-sm"
                data-testid="email-dialog-messaggio"
              />
              <div className="text-[11px] text-zinc-500 mt-1">
                Apparirà in evidenza nel corpo dell'email dopo il saluto "Gentile {prev.cliente?.nome || "Cliente"}".
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setEmailDialog((d) => ({ ...d, open: false }))}
              disabled={emailSending}
              data-testid="email-dialog-cancel"
            >Annulla</Button>
            <Button
              onClick={async () => {
                const dest = emailDialog.destinatario.trim();
                if (!dest) { toast.error("Inserisci l'email destinatario"); return; }
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dest)) { toast.error("Email non valida"); return; }
                // Se cliente non aveva email, salvala (PATCH minimo)
                if (!prev.cliente?.email || prev.cliente.email !== dest) {
                  try {
                    await api.put(`/preventivi/${id}`, { cliente: { ...(prev.cliente || {}), email: dest } });
                    setPrev((p) => ({ ...p, cliente: { ...(p.cliente || {}), email: dest } }));
                  } catch (_) { /* ignore */ }
                }
                setEmailSending(true);
                try {
                  const { data } = await api.post(`/preventivi/${id}/invia-email`, { destinatario: dest, messaggio: emailDialog.messaggio });
                  if (data?.ok) {
                    toast.success(`✅ Email inviata a ${data.sent_to || dest}. Suggerisci al cliente di controllare anche lo spam.`);
                    setEmailDialog({ open: false, destinatario: "", messaggio: "" });
                  } else {
                    // SMTP rifiutato → mailto fallback
                    const isPreview = window.location.host.includes("preview.emergentagent");
                    const causa = isPreview
                      ? "Sei sull'ambiente di Preview: l'IP non è whitelisted da Aruba. Su sadicasa.it dovrebbe funzionare."
                      : "SMTP Aruba ha rifiutato la connessione (IP server in blacklist o credenziali errate).";
                    if (window.confirm(`❌ Invio automatico fallito.\n\n${causa}\n\nApro il tuo client email (Apple Mail/Outlook) con il messaggio precompilato?`)) {
                      const link = `${window.location.origin}/preventivi/${id}/stampa`;
                      const subject = `Preventivo ${prev.numero} — ${azienda.nome || "Sa di casa"}`;
                      const nomeC = (prev.cliente?.nome || "") + (prev.cliente?.cognome ? " " + prev.cliente.cognome : "");
                      const body = `Gentile ${nomeC.trim() || "Cliente"},\n\n${emailDialog.messaggio ? emailDialog.messaggio + "\n\n" : ""}le invio il riepilogo del preventivo ${prev.numero}.\n\nDettaglio completo (A4, validità 30 giorni):\n${link}\n\nTotale IVA inclusa: € ${(prev.totale_iva_incl || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}\nMetri quadri: ${prev.mq || "-"} m²\n\nResto a disposizione.\n\nCordiali saluti`;
                      window.location.href = `mailto:${dest}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                    }
                  }
                } catch (e) {
                  toast.error("Errore invio: " + (e?.response?.data?.detail || e.message));
                }
                setEmailSending(false);
              }}
              disabled={emailSending}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              data-testid="email-dialog-send"
            >
              <Send className="h-4 w-4 mr-2" />
              {emailSending ? "Invio in corso..." : "Invia ora"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
