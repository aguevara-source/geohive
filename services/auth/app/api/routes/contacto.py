import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from ...core.config import settings
from ...services import correo

router = APIRouter(tags=["Contacto"])
log = logging.getLogger("contacto")


class ContactoIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=80)
    correo: str = Field(min_length=5, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    telefono: str | None = Field(None, max_length=20, pattern=r"^[+0-9 ()-]*$")
    mensaje: str = Field(min_length=2, max_length=2000)
    # Campo trampa: invisible para personas, los bots lo llenan
    sitio: str | None = Field(None, max_length=200)


@router.post("/contacto", status_code=status.HTTP_202_ACCEPTED)
def contacto(datos: ContactoIn):
    """Mensaje del formulario del portal: se envía por correo a CONTACTO_DESTINO."""
    if datos.sitio:
        return {"ok": True}  # bot: se ignora sin avisarle
    if not settings.contacto_destino:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "El formulario de contacto no está configurado")
    nombre = " ".join(datos.nombre.split())
    try:
        correo.enviar_contacto(nombre, datos.correo.strip(), (datos.telefono or "").strip() or None, datos.mensaje.strip())
    except Exception:
        log.exception("No se pudo enviar el mensaje de contacto")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "No se pudo enviar el mensaje")
    return {"ok": True}
