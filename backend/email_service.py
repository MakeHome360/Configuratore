"""
Servizio email centralizzato — SMTP Aruba (o qualsiasi server SMTP).

Tutte le funzioni sono asincrone e non bloccanti.
In caso di errore, viene loggato ma NON sollevato: l'email è "best-effort" e non blocca i flussi business (registrazione, sconto, ecc.).

Variabili d'ambiente richieste (in /app/backend/.env):
- SMTP_HOST           (es. smtps.aruba.it)
- SMTP_PORT           (es. 465)
- SMTP_USE_SSL        (true/false — true per porta 465, false per 587)
- SMTP_USER           (es. noreply@sadicasa.it)
- SMTP_PASSWORD       (password della casella)
- SMTP_FROM_EMAIL     (mittente visibile)
- SMTP_FROM_NAME      (nome mittente, es. "Sa di casa")
- APP_PUBLIC_URL      (URL pubblico per i link nelle email)
"""
import os
import logging
from email.message import EmailMessage
from email.utils import formataddr
from typing import List, Optional, Dict, Any

import aiosmtplib

logger = logging.getLogger(__name__)


def _cfg() -> Dict[str, Any]:
    return {
        "host": os.environ.get("SMTP_HOST", ""),
        "port": int(os.environ.get("SMTP_PORT") or 465),
        "use_ssl": (os.environ.get("SMTP_USE_SSL") or "true").lower() == "true",
        "user": os.environ.get("SMTP_USER", ""),
        "password": os.environ.get("SMTP_PASSWORD", ""),
        "from_email": os.environ.get("SMTP_FROM_EMAIL") or os.environ.get("SMTP_USER", ""),
        "from_name": os.environ.get("SMTP_FROM_NAME") or "Sa di casa",
        "reply_to_default": os.environ.get("SMTP_REPLY_TO", ""),
        "app_url": os.environ.get("APP_PUBLIC_URL", ""),
    }


def is_email_enabled() -> bool:
    c = _cfg()
    return bool(c["host"] and c["user"] and c["password"])


async def send_email(
    to: str | List[str],
    subject: str,
    html: str,
    text: Optional[str] = None,
    reply_to: Optional[str] = None,
    cc: Optional[List[str]] = None,
) -> bool:
    """Invia una mail. Ritorna True se accettata dal server SMTP, False altrimenti.
    Non solleva: gli errori vengono solo loggati."""
    c = _cfg()
    if not is_email_enabled():
        logger.warning("[EMAIL] SMTP non configurato — skip invio a %s (subject=%s)", to, subject)
        return False

    recipients = [to] if isinstance(to, str) else list(to)
    if not recipients:
        return False

    msg = EmailMessage()
    msg["From"] = formataddr((c["from_name"], c["from_email"]))
    msg["To"] = ", ".join(recipients)
    if cc:
        msg["Cc"] = ", ".join(cc)
    # Reply-To: se non specificato dal chiamante, usa quello di default (es. info@sadicasa.it)
    eff_reply_to = reply_to or c.get("reply_to_default") or ""
    if eff_reply_to:
        msg["Reply-To"] = eff_reply_to
    msg["Subject"] = subject
    # Plain text fallback
    msg.set_content(text or _html_to_text(html))
    msg.add_alternative(html, subtype="html")

    try:
        if c["use_ssl"]:
            # SSL diretto su porta 465 (Aruba)
            await aiosmtplib.send(
                msg,
                hostname=c["host"],
                port=c["port"],
                username=c["user"],
                password=c["password"],
                use_tls=True,
                timeout=30,
            )
        else:
            # STARTTLS su porta 587
            await aiosmtplib.send(
                msg,
                hostname=c["host"],
                port=c["port"],
                username=c["user"],
                password=c["password"],
                start_tls=True,
                timeout=30,
            )
        logger.info("[EMAIL] inviata a %s (subject=%s)", recipients, subject)
        return True
    except Exception as e:
        logger.exception("[EMAIL] errore invio a %s: %s", recipients, e)
        return False


def _html_to_text(html: str) -> str:
    import re
    txt = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
    txt = re.sub(r"<[^>]+>", "", txt)
    return txt.strip()


# ============== TEMPLATES HTML ==============
# Tutti i template seguono lo stesso layout minimale e responsive

def _wrap(content_html: str, title: str = "Sa di casa", azienda: Optional[Dict[str, Any]] = None) -> str:
    """Template HTML email professionale con branding dinamico dell'azienda.
    Se `azienda` è passata, usa logo, ragione sociale, colore primario e contatti.
    """
    c = _cfg()
    app_url = c["app_url"] or "#"
    az = azienda or {}
    nome = az.get("marchio_commerciale") or az.get("nome") or "Sa di casa"
    ragione = az.get("ragione_sociale") or ""
    colore = az.get("colore_primario") or "#0F766E"
    logo_url = az.get("logo") or ""
    sito = az.get("sito") or app_url
    pec = az.get("pec") or ""
    piva = az.get("partita_iva") or az.get("piva") or ""
    indirizzo = " ".join(filter(None, [
        az.get("sede_legale_indirizzo"), az.get("sede_legale_cap"),
        az.get("sede_legale_citta"),
        f"({az.get('sede_legale_provincia')})" if az.get("sede_legale_provincia") else "",
    ])).strip() or az.get("indirizzo") or ""
    tel = az.get("telefono_principale") or az.get("telefono") or ""
    email_az = az.get("email_principale") or az.get("email") or ""

    logo_html = (
        f'<img src="{logo_url}" alt="{nome}" style="max-height:48px;max-width:200px;display:block;margin:0 0 10px;background:#ffffff;padding:4px 8px;border-radius:4px;">'
        if logo_url else
        f'<div style="font-family:\'Helvetica Neue\',Arial,sans-serif;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;margin-bottom:6px;">{nome}</div>'
    )
    footer_lines = []
    if ragione: footer_lines.append(f'<strong style="color:#3f3f46;">{ragione}</strong>')
    if indirizzo: footer_lines.append(indirizzo)
    contact_line = " · ".join(filter(None, [
        f'tel {tel}' if tel else "",
        email_az,
        f'PEC: {pec}' if pec else "",
    ]))
    if contact_line: footer_lines.append(contact_line)
    if piva: footer_lines.append(f'P.IVA {piva}')
    if sito and sito not in ("", "#"): footer_lines.append(f'<a href="{sito}" style="color:#71717a;text-decoration:underline;">{sito.replace("https://","").replace("http://","")}</a>')
    footer_html = "<br>".join(footer_lines) if footer_lines else f'<a href="{app_url}" style="color:#71717a;">{app_url}</a>'

    return f"""<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#18181b;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f4f4f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="640" style="max-width:640px;background:#ffffff;border:1px solid #e4e4e7;border-radius:6px;overflow:hidden;">
        <tr><td style="padding:28px 36px;background:{colore};color:#ffffff;">
          {logo_html}
          <div style="font-size:11px;letter-spacing:2.5px;text-transform:uppercase;opacity:0.85;margin-top:8px;">{title}</div>
        </td></tr>
        <tr><td style="padding:36px;line-height:1.6;font-size:15px;">{content_html}</td></tr>
        <tr><td style="padding:22px 36px;background:#f4f4f5;color:#71717a;font-size:11px;line-height:1.6;border-top:1px solid #e4e4e7;">
          {footer_html}
          <div style="margin-top:10px;padding-top:10px;border-top:1px solid #e4e4e7;font-size:10px;color:#a1a1aa;">
            Email automatica inviata dalla piattaforma {nome}. Per rispondere usa l'indirizzo del tuo referente in cima al messaggio.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _btn(label: str, url: str, color: str = "#0f172a") -> str:
    return f'<a href="{url}" style="display:inline-block;background:{color};color:#ffffff;text-decoration:none;padding:14px 28px;font-weight:600;font-size:14px;letter-spacing:0.3px;border-radius:4px;">{label}</a>'


# ============== TEMPLATE: PREVENTIVO al cliente ==============
async def send_preventivo_email(
    to: str,
    preventivo: Dict[str, Any],
    azienda: Dict[str, Any],
    incaricato: Dict[str, Any],
    custom_message: str = "",
) -> bool:
    """Email professionale al cliente con riepilogo preventivo, dati incaricato e link al PDF.
    Tipo documento configurabile in futuro (preventivo/fattura/contratto)."""
    c = _cfg()
    cliente = preventivo.get("cliente") or {}
    nome_cliente_raw = (cliente.get("nome") or "").strip()
    cognome_cliente = (cliente.get("cognome") or "").strip()
    nome_completo = (nome_cliente_raw + (" " + cognome_cliente if cognome_cliente else "")).strip() or "Cliente"
    # Stabilisci se "Gentile Sig./Sig.ra" o solo "Gentile"
    saluto = f"Gentile {nome_completo}"

    numero = preventivo.get("numero") or preventivo.get("id", "")[:8]
    totale = float(preventivo.get("totale_iva_incl") or 0)
    iva_pct = preventivo.get("iva_pct") or 10
    mq = preventivo.get("mq") or "—"
    indirizzo_cantiere = cliente.get("indirizzo") or ""
    tipo_preventivo = preventivo.get("tipo", "preventivo")
    pacchetto = preventivo.get("package_name") or ""
    nome_azienda = azienda.get("marchio_commerciale") or azienda.get("nome") or "Sa di casa"
    incaricato_nome = ((incaricato.get("name") or "") + (" " + incaricato.get("cognome") if incaricato.get("cognome") else "")).strip() or "Il vostro referente"
    incaricato_email = incaricato.get("email") or azienda.get("email_principale") or azienda.get("email") or ""
    incaricato_tel = incaricato.get("telefono") or ""
    incaricato_qualifica = incaricato.get("qualifica") or "Consulente Ristrutturazione"
    colore = azienda.get("colore_primario") or "#0F766E"
    app_url = c["app_url"] or ""
    link_preventivo = f"{app_url}/preventivi/{preventivo.get('id')}/stampa"

    # Validità preventivo: 30 giorni
    from datetime import datetime as _dt, timedelta as _td
    valido_fino = (_dt.now() + _td(days=30)).strftime("%d/%m/%Y")

    custom_block = (
        f'<div style="background:#fefce8;border-left:4px solid #ca8a04;padding:14px 18px;margin:20px 0;font-style:italic;color:#713f12;">{custom_message}</div>'
        if custom_message else ""
    )

    riepilogo_rows = []
    if pacchetto:
        riepilogo_rows.append(("Pacchetto", pacchetto.upper()))
    if tipo_preventivo == "composite":
        riepilogo_rows.append(("Tipologia", "Preventivo personalizzato"))
    riepilogo_rows.append(("Metri quadri", f"{mq} m²"))
    if indirizzo_cantiere:
        riepilogo_rows.append(("Cantiere", indirizzo_cantiere))
    riepilogo_rows.append(("Validità offerta", f"<strong>fino al {valido_fino}</strong> (30 giorni)"))

    riepilogo_html = "".join([
        f'<tr><td style="background:#f9fafb;font-weight:600;width:42%;color:#52525b;padding:10px 14px;border-bottom:1px solid #e4e4e7;">{label}</td>'
        f'<td style="padding:10px 14px;border-bottom:1px solid #e4e4e7;">{value}</td></tr>'
        for label, value in riepilogo_rows
    ])

    body = f"""
    <p style="font-size:17px;margin:0 0 6px;font-weight:600;color:#18181b;">{saluto},</p>
    <p style="margin:0 0 18px;color:#3f3f46;">
      grazie per aver scelto <strong>{nome_azienda}</strong> per la sua ristrutturazione.
      Come anticipato, le inviamo qui di seguito il <strong>preventivo n. {numero}</strong>
      con il dettaglio completo delle lavorazioni proposte.
    </p>

    {custom_block}

    <h3 style="margin:28px 0 12px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#71717a;font-weight:600;border-bottom:2px solid {colore};padding-bottom:6px;">Riepilogo offerta</h3>
    <table cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;font-size:14px;">
      {riepilogo_html}
    </table>

    <div style="background:{colore};color:#ffffff;text-align:center;padding:24px;margin:24px 0;border-radius:6px;">
      <div style="font-size:11px;letter-spacing:2.5px;text-transform:uppercase;opacity:0.85;margin-bottom:6px;">Investimento totale chiavi in mano</div>
      <div style="font-size:36px;font-weight:700;letter-spacing:-1px;">€ {totale:,.2f}</div>
      <div style="font-size:12px;opacity:0.9;margin-top:4px;">IVA inclusa al {iva_pct}% · Nessun costo nascosto</div>
    </div>

    <p style="margin:0 0 18px;">
      Cliccando il pulsante qui sotto può consultare il <strong>dettaglio completo</strong>
      del preventivo (lavorazioni voce per voce, materiali, termini contrattuali) e
      scaricarlo in formato PDF.
    </p>

    <p style="text-align:center;margin:28px 0;">
      {_btn("Apri il preventivo completo", link_preventivo, colore)}
    </p>

    <p style="margin:24px 0 8px;color:#3f3f46;">
      Resto a disposizione per qualsiasi chiarimento, per personalizzare ulteriormente
      l'offerta o per fissare un <strong>sopralluogo tecnico gratuito</strong>.
    </p>

    <p style="margin:0 0 4px;color:#3f3f46;">Un cordiale saluto,</p>

    <table cellspacing="0" cellpadding="0" border="0" style="margin-top:18px;border-collapse:collapse;">
      <tr>
        <td style="border-left:3px solid {colore};padding:6px 0 6px 14px;">
          <div style="font-weight:600;font-size:15px;color:#18181b;">{incaricato_nome}</div>
          <div style="font-size:12px;color:#71717a;font-style:italic;">{incaricato_qualifica}</div>
          {f'<div style="font-size:12px;color:#3f3f46;margin-top:6px;">📧 <a href="mailto:{incaricato_email}" style="color:#3f3f46;text-decoration:none;">{incaricato_email}</a></div>' if incaricato_email else ""}
          {f'<div style="font-size:12px;color:#3f3f46;">📱 {incaricato_tel}</div>' if incaricato_tel else ""}
        </td>
      </tr>
    </table>
    """
    subject = f"Preventivo {numero} — {nome_azienda}"
    return await send_email(
        to=to,
        subject=subject,
        html=_wrap(body, f"Preventivo n. {numero}", azienda),
        reply_to=incaricato_email or azienda.get("email_principale") or azienda.get("email"),
    )


# ============== TEMPLATE: REGISTRAZIONE ==============
async def send_welcome_email(to: str, name: str, role: str = "utente") -> bool:
    c = _cfg()
    body = f"""
    <p style="font-size:16px;margin:0 0 16px;">Ciao <strong>{name}</strong>,</p>
    <p>il tuo account <strong>Sa di casa</strong> è stato creato con successo come <strong>{role}</strong>.</p>
    <p>Puoi accedere alla piattaforma cliccando qui sotto:</p>
    <p style="margin:24px 0;">{_btn("Accedi al portale", c["app_url"] + "/login")}</p>
    <p style="color:#71717a;font-size:13px;">Se non hai richiesto questo account, ignora questa email.</p>
    """
    return await send_email(to, "Benvenuto su Sa di casa", _wrap(body, "Benvenuto"))


# ============== TEMPLATE: INVITO (cliente, venditore, sub, PM) ==============
async def send_invite_email(to: str, name: str, role: str, temp_password: Optional[str] = None, custom_message: str = "") -> bool:
    c = _cfg()
    pwd_block = f'<p style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;margin:16px 0;font-family:monospace;font-size:14px;">Password temporanea: <strong>{temp_password}</strong><br><span style="font-size:11px;color:#92400e;">Cambiala al primo accesso.</span></p>' if temp_password else ""
    role_label = {"cliente": "cliente", "venditore": "venditore", "subappaltatore": "subappaltatore", "gestore": "gestore cantieri"}.get(role, role)
    body = f"""
    <p style="font-size:16px;margin:0 0 16px;">Ciao <strong>{name}</strong>,</p>
    <p>sei stato invitato sulla piattaforma <strong>Sa di casa</strong> come <strong>{role_label}</strong>.</p>
    {f'<p style="background:#f4f4f5;padding:12px 16px;border-left:4px solid #0f172a;font-style:italic;">{custom_message}</p>' if custom_message else ""}
    {pwd_block}
    <p>Accedi cliccando qui:</p>
    <p style="margin:24px 0;">{_btn("Accedi al portale", c["app_url"] + "/login")}</p>
    """
    return await send_email(to, f"Invito su Sa di casa — {role_label}", _wrap(body, "Sei stato invitato"))


# ============== TEMPLATE: OTP firma documenti ==============
async def send_otp_email(to: str, name: str, otp: str, documento_nome: str) -> bool:
    body = f"""
    <p style="font-size:16px;margin:0 0 16px;">Ciao <strong>{name}</strong>,</p>
    <p>per firmare il documento <strong>{documento_nome}</strong> inserisci il seguente codice OTP nella piattaforma:</p>
    <div style="text-align:center;margin:32px 0;padding:24px;background:#f4f4f5;border:2px dashed #0f172a;">
      <div style="font-size:32px;font-family:monospace;font-weight:700;letter-spacing:6px;color:#0f172a;">{otp}</div>
      <div style="font-size:11px;color:#71717a;margin-top:8px;text-transform:uppercase;letter-spacing:2px;">scade fra 10 minuti</div>
    </div>
    <p style="color:#71717a;font-size:13px;">Se non hai richiesto questa firma, ignora questa email. Il codice scadrà automaticamente.</p>
    """
    return await send_email(to, f"Codice OTP per firma — {documento_nome}", _wrap(body, "Codice di firma"))


# ============== TEMPLATE: NOTIFICA SCONTO ALL'ADMIN ==============
async def send_sconto_request_admin_email(to: str, venditore_nome: str, preventivo_numero: str, cliente_nome: str, pct: float, motivo: str, margine_attuale_pct: float, margine_se_approvo_pct: float) -> bool:
    c = _cfg()
    body = f"""
    <p style="font-size:16px;margin:0 0 16px;">Nuova <strong>richiesta sconto</strong> da approvare.</p>
    <table cellspacing="0" cellpadding="8" style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="background:#f4f4f5;font-weight:600;width:40%;">Venditore</td><td>{venditore_nome}</td></tr>
      <tr><td style="background:#f4f4f5;font-weight:600;">Preventivo</td><td>{preventivo_numero}</td></tr>
      <tr><td style="background:#f4f4f5;font-weight:600;">Cliente</td><td>{cliente_nome}</td></tr>
      <tr><td style="background:#f4f4f5;font-weight:600;">% richiesta</td><td><strong style="color:#d97706;font-size:18px;">{pct}%</strong></td></tr>
      <tr><td style="background:#f4f4f5;font-weight:600;">Margine ATTUALE</td><td>{margine_attuale_pct:.1f}%</td></tr>
      <tr><td style="background:#f4f4f5;font-weight:600;">Margine SE APPROVI</td><td><strong style="color:{'#dc2626' if margine_se_approvo_pct < 20 else '#059669'};">{margine_se_approvo_pct:.1f}%</strong></td></tr>
    </table>
    <p style="background:#f4f4f5;padding:12px 16px;border-left:4px solid #0f172a;font-style:italic;"><strong>Motivo:</strong> {motivo}</p>
    <p style="margin:24px 0;">{_btn("Vai alle richieste sconto", c["app_url"] + "/adminscontorichieste")}</p>
    """
    return await send_email(to, f"⚠ Richiesta sconto {pct}% — {preventivo_numero}", _wrap(body, "Richiesta sconto"))


# ============== TEMPLATE: NOTIFICA DECISIONE SCONTO AL VENDITORE ==============
async def send_sconto_decision_email(to: str, venditore_nome: str, preventivo_numero: str, cliente_nome: str, stato: str, pct_approvato: Optional[float], pct_richiesto: float, admin_note: str = "") -> bool:
    c = _cfg()
    approved = stato == "approvato"
    color = "#059669" if approved else "#dc2626"
    icon = "✓" if approved else "✗"
    title = "Sconto approvato" if approved else "Sconto rifiutato"
    pct_msg = f"<strong>{pct_approvato}%</strong>" + (f" (rispetto al {pct_richiesto}% richiesto)" if pct_approvato is not None and pct_approvato != pct_richiesto else "")
    body = f"""
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:60px;height:60px;line-height:60px;border-radius:50%;background:{color};color:#fff;font-size:32px;font-weight:700;">{icon}</div>
      <h2 style="margin:12px 0 0;color:{color};font-weight:600;">{title}</h2>
    </div>
    <p>Ciao <strong>{venditore_nome}</strong>,</p>
    <p>la tua richiesta di sconto sul preventivo <strong>{preventivo_numero}</strong> ({cliente_nome}) è stata <strong style="color:{color};">{stato}</strong>{(' al ' + pct_msg) if approved else ''}.</p>
    {f'<p style="background:#f4f4f5;padding:12px 16px;border-left:4px solid #0f172a;font-style:italic;"><strong>Nota admin:</strong> {admin_note}</p>' if admin_note else ""}
    <p style="margin:24px 0;">{_btn("Vai al preventivo", c["app_url"] + "/preventivi")}</p>
    """
    return await send_email(to, f"{icon} Sconto {stato} — {preventivo_numero}", _wrap(body, title))


# ============== TEMPLATE: REMINDER GENERICO ==============
async def send_reminder_email(to: str, name: str, subject: str, items: List[Dict[str, str]], cta_label: str = "Vai alla piattaforma", cta_path: str = "/") -> bool:
    c = _cfg()
    items_html = "".join([f'<li style="margin-bottom:8px;"><strong>{it.get("title", "")}</strong>{": " + it.get("detail", "") if it.get("detail") else ""}</li>' for it in items])
    body = f"""
    <p style="font-size:16px;margin:0 0 16px;">Ciao <strong>{name}</strong>,</p>
    <p>ecco un promemoria dalle tue attività su Sa di casa:</p>
    <ul style="background:#f4f4f5;padding:16px 24px;border-radius:0;font-size:14px;">{items_html}</ul>
    <p style="margin:24px 0;">{_btn(cta_label, c["app_url"] + cta_path)}</p>
    """
    return await send_email(to, subject, _wrap(body, "Promemoria"))
