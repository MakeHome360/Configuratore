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
    if reply_to:
        msg["Reply-To"] = reply_to
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

def _wrap(content_html: str, title: str = "Sa di casa") -> str:
    c = _cfg()
    app_url = c["app_url"] or "#"
    return f"""<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18181b;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f4f4f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;">
        <tr><td style="padding:24px 32px;background:#0f172a;color:#ffffff;">
          <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:0.7;">Sa di casa · Ristruttura.CAD</div>
          <div style="font-size:20px;font-weight:600;margin-top:6px;">{title}</div>
        </td></tr>
        <tr><td style="padding:32px;">{content_html}</td></tr>
        <tr><td style="padding:20px 32px;background:#f4f4f5;color:#71717a;font-size:11px;line-height:1.5;border-top:1px solid #e4e4e7;">
          Email automatica — non rispondere a questo messaggio.<br>
          Sa di casa · <a href="{app_url}" style="color:#71717a;">{app_url}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _btn(label: str, url: str) -> str:
    return f'<a href="{url}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 24px;font-weight:600;font-size:14px;letter-spacing:0.3px;">{label}</a>'


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
