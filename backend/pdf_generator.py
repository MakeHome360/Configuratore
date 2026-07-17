"""
R89 quater: Server-side PDF generation for Preventivi (weasyprint).
Fixes iOS Safari download + eliminates html2canvas rendering bugs (prezzi mancanti, testi troncati, logo doppio).
"""
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone, timedelta
from weasyprint import HTML
from io import BytesIO
import html as html_escape_module


def _esc(v) -> str:
    if v is None:
        return ""
    return html_escape_module.escape(str(v))


def _fmt_eur(v: float) -> str:
    try:
        n = float(v or 0)
    except (TypeError, ValueError):
        n = 0
    # Formato italiano: 12.345,67 €
    s = f"{n:,.2f}"
    s = s.replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{s} €"


def _fmt_date_ita(iso: Optional[str]) -> str:
    if not iso:
        return ""
    try:
        d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except Exception:
        return ""
    mesi = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
            "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"]
    return f"{d.day} {mesi[d.month-1]} {d.year}"


def _row_bagno(prev: Dict[str, Any], tier: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows = []
    manodopera = float(prev.get("manodopera_base") or 0)
    if manodopera > 0:
        rows.append({
            "descrizione": "Manodopera base bagno",
            "sotto": "Include: demolizione bagno esistente, sostituzione impianto idraulico ed elettrico, massetto e impermeabilizzazione, posa piastrelle a pavimento e rivestimento, rasatura e pittura pareti/soffitto, installazione sanitari e miscelatori, smaltimento macerie.",
            "totale": manodopera,
        })
    if tier:
        tier_items = tier.get("included_items") or []
        items_html = ""
        if tier_items:
            cols = "".join(f"<li>{_esc(it)}</li>" for it in tier_items)
            items_html = f'<ul class="incl">{cols}</ul>'
        rows.append({
            "descrizione": f"Pacchetto sanitari · {_esc(tier.get('name'))}",
            "sotto_raw": f'<div class="tier-desc" style="color:{_esc(tier.get("color","#94A3B8"))}">{_esc(tier.get("description",""))}</div>{items_html}',
            "totale": float(tier.get("price") or 0),
        })
    p_mq = float(prev.get("piastrelle_mq") or 0)
    p_pu = float(prev.get("piastrelle_prezzo_mq") or 0)
    if p_mq * p_pu > 0:
        rows.append({
            "descrizione": "Piastrelle",
            "sotto": f"{p_mq:g} m² × {_fmt_eur(p_pu)}/m²",
            "totale": p_mq * p_pu,
        })
    for x in (prev.get("extra_voci") or []):
        q = float(x.get("qty") or 1)
        pu = float(x.get("prezzo") or 0)
        if q * pu <= 0:
            continue
        rows.append({
            "descrizione": _esc(x.get("nome") or "Extra"),
            "sotto": f"{q:g} × {_fmt_eur(pu)}" if q > 1 else "",
            "totale": q * pu,
        })
    return rows


def _row_composite(prev: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows = []
    # items base
    for it in (prev.get("items") or []):
        if it.get("excluded"):
            continue
        q = float(it.get("qty_richiesta") or it.get("qty") or 0)
        pu = float(it.get("unit_price") or it.get("prezzo_unit") or 0)
        if q * pu <= 0 and q <= 0:
            continue
        rows.append({
            "descrizione": _esc(it.get("name") or "Voce"),
            "sotto": f"{q:g} {_esc(it.get('unit') or 'pz')} × {_fmt_eur(pu)}" if q and pu else "",
            "totale": q * pu,
        })
    for sel in (prev.get("composite_selections") or []):
        if not isinstance(sel, dict):
            continue
        q = float(sel.get("qty") or 0)
        pu = float(sel.get("price") or sel.get("unit_price") or 0)
        if q * pu <= 0:
            continue
        rows.append({
            "descrizione": _esc(sel.get("name") or "Voce"),
            "sotto": f"{q:g} {_esc(sel.get('unit') or 'pz')} × {_fmt_eur(pu)}",
            "totale": q * pu,
        })
    for m in (prev.get("manual_extras") or []):
        q = float(m.get("qty") or 0)
        pu = float(m.get("price") or 0)
        if q * pu <= 0 and pu <= 0:
            continue
        rows.append({
            "descrizione": _esc(m.get("name") or "Extra"),
            "sotto": f"{q:g} × {_fmt_eur(pu)}" if q > 1 else "",
            "totale": q * pu,
        })
    for inf in (prev.get("infissi_extras") or []):
        q = float(inf.get("qty") or 1)
        pu = float(inf.get("unit_price") or inf.get("price") or 0)
        if pu <= 0:
            continue
        rows.append({
            "descrizione": _esc(inf.get("name") or "Infisso"),
            "sotto": f"{q:g} pz × {_fmt_eur(pu)}",
            "totale": q * pu,
        })
    for p in (prev.get("listini_selections") or []):
        q = float(p.get("qty") or 0)
        pu = float(p.get("prezzo_rivendita") or 0)
        if q * pu <= 0:
            continue
        rows.append({
            "descrizione": _esc(p.get("nome") or "Prodotto"),
            "sotto": f"{q:g} × {_fmt_eur(pu)}",
            "totale": q * pu,
        })
    return rows


CSS = """
@page { size: A4; margin: 18mm 14mm; }
* { box-sizing: border-box; }
body { font-family: 'Helvetica Neue', 'Segoe UI', 'Roboto', sans-serif; color: #18181b; font-size: 10pt; margin: 0; line-height: 1.4; }
.header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 2px solid #0d9488; margin-bottom: 14px; }
.logo { font-family: 'Segoe UI', sans-serif; font-size: 20pt; font-weight: 700; color: #0d9488; }
.logo-sub { font-size: 8pt; color: #71717a; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
.company { text-align: right; font-size: 8.5pt; color: #52525b; line-height: 1.5; }
.company b { color: #18181b; }
.title-block { margin: 18px 0 6px; }
.title-block .kicker { font-size: 8pt; text-transform: uppercase; letter-spacing: 2px; color: #71717a; }
.title-block h1 { font-size: 20pt; font-weight: 700; color: #0d9488; margin: 4px 0 6px; }
.title-block .dates { font-size: 9pt; color: #52525b; }
.info-grid { display: table; width: 100%; margin: 10px 0 14px; }
.info-grid > div { display: table-cell; width: 50%; vertical-align: top; padding-right: 12px; }
.info-grid h2 { font-size: 8pt; text-transform: uppercase; letter-spacing: 1.5px; color: #71717a; font-weight: 600; margin: 0 0 4px; }
.info-grid .val { font-size: 11pt; font-weight: 600; }
.info-grid .val-sub { font-size: 9pt; color: #52525b; }
.tot-hero { background: #0d9488; color: white; padding: 18px 20px; text-align: center; border-radius: 6px; margin: 8px 0 18px; }
.tot-hero .lbl { font-size: 8pt; text-transform: uppercase; letter-spacing: 2px; opacity: 0.85; }
.tot-hero .val { font-size: 28pt; font-weight: 700; margin: 4px 0; }
.tot-hero .sub { font-size: 8.5pt; opacity: 0.9; }
h2.sect { font-size: 13pt; font-weight: 700; color: #0d9488; margin: 12px 0 6px; }
p.sect-desc { font-size: 9pt; color: #52525b; margin: 0 0 10px; }
table.rows { width: 100%; border-collapse: collapse; margin-top: 4px; }
table.rows th { background: #f4f4f5; padding: 8px 10px; text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; color: #71717a; font-weight: 600; border-bottom: 1px solid #e4e4e7; }
table.rows th.right { text-align: right; }
table.rows td { padding: 10px; vertical-align: top; border-bottom: 1px solid #f4f4f5; }
table.rows td.desc .name { font-weight: 600; font-size: 10pt; }
table.rows td.desc .sotto { font-size: 8.5pt; color: #71717a; margin-top: 3px; line-height: 1.5; }
table.rows td.total { text-align: right; font-family: 'Menlo','Consolas',monospace; font-weight: 600; white-space: nowrap; min-width: 90pt; }
ul.incl { list-style: none; padding: 0; margin: 6px 0 0; columns: 2; column-gap: 14pt; font-size: 8.5pt; color: #3f3f46; }
ul.incl li { padding: 1px 0 1px 12px; break-inside: avoid; position: relative; }
ul.incl li:before { content: "✓"; color: #10b981; position: absolute; left: 0; font-weight: 700; }
tr.subtot td { background: #fafafa; font-weight: 600; padding: 8px 10px; }
tr.subtot td.right { text-align: right; }
tr.sconto td { background: #ecfdf5; color: #059669; font-weight: 600; }
tr.iva td { font-size: 9pt; color: #52525b; padding: 6px 10px; }
tr.gran-tot td { background: #18181b; color: white; font-weight: 700; font-size: 14pt; padding: 12px 10px; }
tr.gran-tot td.right { font-family: 'Menlo','Consolas',monospace; }
.legal { margin-top: 20px; padding: 12px 14px; background: #fef3c7; border-left: 4px solid #f59e0b; font-size: 8.5pt; color: #78350f; line-height: 1.5; border-radius: 3px; }
.legal b { color: #92400e; }
.terms { margin-top: 14px; font-size: 9pt; color: #3f3f46; line-height: 1.55; }
.terms h2 { font-size: 11pt; color: #0d9488; margin: 0 0 4px; font-weight: 700; }
.firma-block { display: table; width: 100%; margin-top: 30px; }
.firma-block > div { display: table-cell; width: 50%; padding: 14px 14px 34px; border: 1px dashed #a1a1aa; vertical-align: top; }
.firma-block .lbl { font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; color: #71717a; font-weight: 600; margin-bottom: 6px; }
.firma-block .name { font-size: 10pt; font-weight: 600; }
.firma-block .placeholder { font-size: 8pt; color: #a1a1aa; margin-top: 20px; font-style: italic; }
.footer { position: fixed; bottom: 6mm; left: 14mm; right: 14mm; font-size: 7.5pt; color: #a1a1aa; text-align: center; border-top: 1px solid #e4e4e7; padding-top: 4pt; }
"""


def build_preventivo_html(
    prev: Dict[str, Any],
    dati_azienda: Dict[str, Any],
    bathroom_tier: Optional[Dict[str, Any]] = None,
) -> str:
    numero = _esc(prev.get("numero") or prev.get("id", "")[:8])
    now_iso = prev.get("created_at") or datetime.now(timezone.utc).isoformat()
    # Emesso il
    try:
        d_emesso = datetime.fromisoformat(now_iso.replace("Z", "+00:00"))
    except Exception:
        d_emesso = datetime.now(timezone.utc)
    d_validita = d_emesso + timedelta(days=30)
    cliente = prev.get("cliente") or {}
    tipo = (prev.get("tipo") or "composite").lower()
    is_bagno = tipo == "bagno"

    # Rows
    if is_bagno:
        rows = _row_bagno(prev, bathroom_tier)
    else:
        rows = _row_composite(prev)

    subtotal = sum(r["totale"] for r in rows)
    sconto = float(prev.get("sconto_eur") or 0)
    imponibile = subtotal - sconto
    iva_pct = float(prev.get("iva_pct") or 10)
    # Se totale_iva_incl è pre-salvato, usa quello per il gran totale (rispetta la fonte)
    saved_total = float(prev.get("totale_iva_incl") or 0)
    iva = imponibile * iva_pct / 100
    total_calc = imponibile + iva
    total_final = saved_total if saved_total > 0 else total_calc

    # Rows HTML
    rows_html = ""
    for r in rows:
        sotto_html = r.get("sotto_raw") or (f'<div class="sotto">{_esc(r["sotto"])}</div>' if r.get("sotto") else "")
        rows_html += f"""<tr>
            <td class="desc"><div class="name">{r['descrizione']}</div>{sotto_html}</td>
            <td class="total">{_fmt_eur(r['totale'])}</td>
        </tr>"""

    # Titolo/subtitle
    if is_bagno:
        tipo_label = f"Ristrutturazione Bagno · {_esc((bathroom_tier or {}).get('name', ''))}"
        tier_color = (bathroom_tier or {}).get("color") or "#0d9488"
    else:
        tipo_label = "Preventivo personalizzato"
        tier_color = "#0d9488"

    # Company info
    az_nome = _esc(dati_azienda.get("nome_azienda") or dati_azienda.get("ragione_sociale") or "Sa di casa")
    az_forma = _esc(dati_azienda.get("forma_giuridica") or "")
    az_ind = _esc(dati_azienda.get("indirizzo") or "")
    az_tel = _esc(dati_azienda.get("telefono") or "")
    az_email = _esc(dati_azienda.get("email") or "")
    az_pec = _esc(dati_azienda.get("pec") or "")
    az_piva = _esc(dati_azienda.get("piva") or "")
    az_cf = _esc(dati_azienda.get("cf") or "")
    az_rea = _esc(dati_azienda.get("rea") or "")

    # Email di firma: SOLO info@... o email azienda. Mai admin@admin.it
    email_firma = az_email if "@" in az_email and "admin" not in az_email.lower() else "info@sadicasa.it"

    # Cliente
    cli_nome = _esc(cliente.get("nome") or "—")
    cli_ind = _esc(cliente.get("indirizzo") or "")
    cli_email = _esc(cliente.get("email") or "")
    cli_tel = _esc(cliente.get("telefono") or "")

    html_doc = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div class="header">
  <div>
    <div class="logo">{az_nome}</div>
    <div class="logo-sub">{az_forma}</div>
  </div>
  <div class="company">
    <b>{az_ind}</b><br>
    {("Tel: " + az_tel + "<br>") if az_tel else ""}
    {("Email: " + az_email + "<br>") if az_email else ""}
    {("PEC: " + az_pec + "<br>") if az_pec else ""}
    {("P.IVA " + az_piva + "<br>") if az_piva else ""}
    {("C.F. " + az_cf + "<br>") if az_cf else ""}
    {("REA " + az_rea) if az_rea else ""}
  </div>
</div>

<div class="title-block">
  <div class="kicker">Proposta di ristrutturazione</div>
  <h1>Preventivo {numero}</h1>
  <div class="dates">Emesso il <b>{_fmt_date_ita(now_iso)}</b> · Valido fino al <b>{_fmt_date_ita(d_validita.isoformat())}</b></div>
</div>

<div class="info-grid">
  <div>
    <h2>Spett.le cliente</h2>
    <div class="val">{cli_nome}</div>
    {("<div class='val-sub'>" + cli_ind + "</div>") if cli_ind else ""}
    {("<div class='val-sub'>" + cli_email + "</div>") if cli_email else ""}
    {("<div class='val-sub'>Tel: " + cli_tel + "</div>") if cli_tel else ""}
  </div>
  <div>
    <h2>Tipo di preventivo</h2>
    <div class="val" style="color:{tier_color}">{tipo_label}</div>
    <div class="val-sub">{"Chiavi in mano" if is_bagno else f"{prev.get('mq','')} m²"}</div>
  </div>
</div>

<div class="tot-hero">
  <div class="lbl">Investimento totale chiavi in mano</div>
  <div class="val">{_fmt_eur(total_final)}</div>
  <div class="sub">IVA inclusa al {int(iva_pct)}% · Nessun costo nascosto</div>
</div>

<h2 class="sect">Dettaglio prestazioni e materiali</h2>
<p class="sect-desc">Formula tutto-compreso: manodopera, materiali, sanitari, rubinetterie, piastrelle e finiture.</p>

<table class="rows">
  <thead>
    <tr>
      <th>Descrizione</th>
      <th class="right">Totale</th>
    </tr>
  </thead>
  <tbody>
    {rows_html}
    <tr class="subtot"><td class="right">Subtotale (IVA esclusa)</td><td class="right total">{_fmt_eur(subtotal)}</td></tr>
    {"<tr class='sconto'><td class='right'>Sconto commerciale</td><td class='right total'>− " + _fmt_eur(sconto) + "</td></tr>" if sconto > 0 else ""}
    <tr class="iva"><td class="right">Imponibile</td><td class="right total">{_fmt_eur(imponibile)}</td></tr>
    <tr class="iva"><td class="right">IVA {int(iva_pct)}%</td><td class="right total">{_fmt_eur(iva)}</td></tr>
    <tr class="gran-tot"><td>TOTALE CHIAVI IN MANO</td><td class="right">{_fmt_eur(total_final)}</td></tr>
  </tbody>
</table>

<div class="legal">
  <b>Oggetto del preventivo.</b> Le lavorazioni indicate riguardano esclusivamente l'immobile del cliente qui identificato.
  Il prezzo è comprensivo di IVA {int(iva_pct)}% e non prevede costi aggiuntivi salvo varianti concordate per iscritto.
  Il preventivo ha validità 30 giorni dalla data di emissione. Le quantità potranno essere aggiornate in base ai rilievi finali del progetto esecutivo, con eventuale riproporzionamento del prezzo mediante integrazione firmata.
</div>

<div class="terms">
  <h2>Termini di pagamento</h2>
  Condizioni e scadenze verranno concordate al momento della firma del contratto di appalto.
  Modalità tipiche: 20% alla firma · 40% all'apertura del cantiere · 30% a metà lavori · 10% alla consegna.
</div>

<div class="firma-block">
  <div>
    <div class="lbl">Per accettazione, il cliente</div>
    <div class="name">{cli_nome}</div>
    <div class="placeholder">Data e firma</div>
  </div>
  <div>
    <div class="lbl">Per {az_nome}</div>
    <div class="name">{email_firma}</div>
    <div class="placeholder">Timbro e firma</div>
  </div>
</div>

</body></html>"""
    return html_doc


def render_preventivo_pdf(
    prev: Dict[str, Any],
    dati_azienda: Dict[str, Any],
    bathroom_tier: Optional[Dict[str, Any]] = None,
) -> bytes:
    html = build_preventivo_html(prev, dati_azienda, bathroom_tier)
    buf = BytesIO()
    HTML(string=html).write_pdf(buf)
    return buf.getvalue()
