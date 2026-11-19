"""Envío del código de acceso por SMTP."""
import html
import logging
import smtplib
import ssl
from email.message import EmailMessage

from ..core.config import settings

log = logging.getLogger("correo")


def _html(nombre: str, codigo: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="es"><body style="margin:0;background:#020617;font-family:Arial,Helvetica,sans-serif;color:#e6e9f2">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="max-width:440px;background:#0b1530;border:1px solid #34405e;border-radius:14px">
      <tr><td style="padding:28px 32px 8px;font-size:13px;letter-spacing:4px;color:#d4af37;font-weight:bold">AG-Y GEOHIVE</td></tr>
      <tr><td style="padding:8px 32px;font-size:15px;line-height:1.6">
        Hola {html.escape(nombre)}, usa este código para ingresar a la plataforma:
      </td></tr>
      <tr><td align="center" style="padding:20px 32px">
        <div style="display:inline-block;padding:16px 28px;border:2px solid #d4af37;border-radius:10px;font-size:34px;letter-spacing:10px;font-weight:bold;color:#d4af37;font-family:'Courier New',monospace">{codigo}</div>
      </td></tr>
      <tr><td style="padding:8px 32px 28px;font-size:13px;line-height:1.6;color:#96a0b8">
        Vence en {settings.codigo_minutos} minutos y solo puede usarse una vez.<br>
        Si no solicitaste este código, ignora este mensaje: nadie podrá ingresar sin él.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>"""


def enviar_codigo(destino: str, nombre: str, codigo: str) -> None:
    msg = EmailMessage()
    msg["Subject"] = f"Tu código de acceso GeoHive: {codigo}"
    msg["From"] = settings.correo_remitente
    msg["To"] = destino
    msg.set_content(
        f"Hola {nombre},\n\nTu código de acceso a AG-Y GEOHIVE es: {codigo}\n\n"
        f"Vence en {settings.codigo_minutos} minutos y solo puede usarse una vez.\n"
        "Si no lo solicitaste, ignora este mensaje."
    )
    msg.add_alternative(_html(nombre, codigo), subtype="html")

    try:
        _enviar(msg)
    except Exception:
        log.exception("No se pudo enviar el código a %s", destino)


def _enviar(msg: EmailMessage) -> None:
    if settings.smtp_seguridad == "ssl":
        servidor = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=20,
                                    context=ssl.create_default_context())
    else:
        servidor = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20)
    with servidor:
        if settings.smtp_seguridad == "starttls":
            servidor.starttls(context=ssl.create_default_context())
        if settings.smtp_usuario:
            servidor.login(settings.smtp_usuario, settings.smtp_password)
        servidor.send_message(msg)


def _fila(etiqueta: str, valor: str) -> str:
    return (f'<tr><td style="padding:10px 0;border-bottom:1px solid #1f2a44;color:#96a0b8;font-size:12px;'
            f'letter-spacing:2px;text-transform:uppercase;width:110px;vertical-align:top">{etiqueta}</td>'
            f'<td style="padding:10px 0;border-bottom:1px solid #1f2a44;font-size:15px">{valor}</td></tr>')


def enviar_contacto(nombre: str, correo: str, telefono: str | None, mensaje: str) -> None:
    """Mensaje del formulario del portal al correo de la empresa. Lanza excepción si falla."""
    e = html.escape
    tel = telefono or "—"
    filas = _fila("Nombre", e(nombre)) + _fila("Correo", f'<a href="mailto:{e(correo)}" style="color:#d4af37">{e(correo)}</a>')
    filas += _fila("Teléfono", e(tel))
    cuerpo_html = f"""<!DOCTYPE html>
<html lang="es"><body style="margin:0;background:#020617;font-family:Arial,Helvetica,sans-serif;color:#e6e9f2">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0b1530;border:1px solid #34405e;border-radius:14px">
      <tr><td style="padding:28px 32px 4px;font-size:13px;letter-spacing:4px;color:#d4af37;font-weight:bold">AG-Y GEOHIVE</td></tr>
      <tr><td style="padding:4px 32px 16px;font-size:20px;font-weight:bold">Nuevo mensaje desde la web</td></tr>
      <tr><td style="padding:0 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">{filas}</table></td></tr>
      <tr><td style="padding:20px 32px 8px;color:#96a0b8;font-size:12px;letter-spacing:2px;text-transform:uppercase">Mensaje</td></tr>
      <tr><td style="padding:0 32px 24px;font-size:15px;line-height:1.6;white-space:pre-wrap">{e(mensaje)}</td></tr>
      <tr><td style="padding:0 32px 28px">
        <a href="mailto:{e(correo)}" style="display:inline-block;background:#d4af37;color:#000;text-decoration:none;font-weight:bold;font-size:13px;padding:12px 24px;border-radius:999px">Responder a {e(nombre)}</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>"""
    msg = EmailMessage()
    msg["Subject"] = f"Nuevo mensaje desde la web AG-Y GEOHIVE — {nombre}"
    msg["From"] = settings.correo_remitente
    msg["To"] = settings.contacto_destino
    msg["Reply-To"] = correo
    msg.set_content(f"Nuevo mensaje desde la web AG-Y GEOHIVE\n\nNombre: {nombre}\nCorreo: {correo}\n"
                    f"Teléfono: {tel}\n\n{mensaje}\n")
    msg.add_alternative(cuerpo_html, subtype="html")
    _enviar(msg)
