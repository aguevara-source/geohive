from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from ...core import criptografia, llaves
from ...core.config import settings
from ...db.session import engine
from ...services import actividad, codigos, correo, sesiones
from ...services.sesiones import UsuarioSesion
from ..deps import ip_cliente, sesion_actual

router = APIRouter(tags=["Inicio de sesión"])

EMAIL = Field(min_length=5, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class CorreoIn(BaseModel):
    email: str = EMAIL


class VerificarIn(BaseModel):
    email: str = EMAIL
    codigo: str = Field(min_length=6, max_length=10)


APP = Field(pattern=r"^[a-z][a-z0-9-]{1,49}$")


class TokenIn(BaseModel):
    app: str = APP


class UbicacionIn(BaseModel):
    permiso: Literal["concedido", "denegado", "no_disponible"]
    latitud: float | None = Field(None, ge=-90, le=90)
    longitud: float | None = Field(None, ge=-180, le=180)
    precision_m: float | None = Field(None, ge=0, le=1_000_000)


class UsoIn(BaseModel):
    app: str = APP
    modulo: str = Field(pattern=r"^[a-z][a-z0-9_-]{1,59}$")


class FinUsoIn(BaseModel):
    segundos: int = Field(ge=0, le=86_400)


@router.post("/codigo")
def solicitar_codigo(datos: CorreoIn, request: Request, tareas: BackgroundTasks):
    """Paso 1: envía un código de 4 dígitos y 2 letras al correo, si está registrado."""
    email = datos.email.strip().lower()
    try:
        with engine.begin() as db:
            generado = codigos.solicitar(db, email, ip_cliente(request))
    except codigos.DemasiadasSolicitudes:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Solicitaste demasiados códigos. Intenta nuevamente en una hora.")

    # El correo se envía después de responder, así la respuesta no revela si el correo existe
    if generado:
        tareas.add_task(correo.enviar_codigo, email, generado.nombre, generado.codigo)
    return {
        "mensaje": "Si el correo está registrado, recibirás un código en unos segundos.",
        "vence_en_minutos": settings.codigo_minutos,
    }


@router.post("/verificar")
def verificar_codigo(datos: VerificarIn, request: Request, response: Response):
    """Paso 2: valida el código y abre la sesión (cookie httpOnly)."""
    email = datos.email.strip().lower()
    ip, agente = ip_cliente(request), request.headers.get("user-agent")
    with engine.begin() as db:
        resultado = codigos.verificar(db, email, datos.codigo, ip)
        token = None
        if resultado.ok:
            token, sesion_id = sesiones.crear(db, resultado.usuario_id, ip, agente)
            actividad.registrar_ingreso(db, resultado.usuario_id, sesion_id, ip, agente)

    if not resultado.ok:
        if resultado.vencido:
            detalle = "El código venció o ya fue usado. Solicita uno nuevo."
        elif resultado.intentos_restantes == 0:
            detalle = "Código bloqueado por demasiados intentos. Solicita uno nuevo."
        else:
            detalle = f"Código incorrecto. Te quedan {resultado.intentos_restantes} intento(s)."
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detalle)

    response.set_cookie(
        settings.cookie_name, token, max_age=settings.sesion_horas * 3600,
        httponly=True, secure=settings.cookie_secure, samesite="lax", path="/auth",
    )
    return {"ok": True}


@router.get("/sesion")
def sesion(usuario: UsuarioSesion = Depends(sesion_actual)):
    """Datos del usuario con sesión abierta (lo usan las apps al cargar)."""
    with engine.begin() as db:
        pendiente = actividad.ubicacion_pendiente(db, usuario.sesion_id)
    return {**usuario.a_dict(), "ubicacion_pendiente": pendiente}


@router.post("/ubicacion", status_code=status.HTTP_204_NO_CONTENT)
def ubicacion(datos: UbicacionIn, usuario: UsuarioSesion = Depends(sesion_actual)):
    """Ubicación del navegador para el ingreso de esta sesión (o que la persona no quiso compartirla)."""
    con_coordenadas = datos.permiso == "concedido" and datos.latitud is not None and datos.longitud is not None
    with engine.begin() as db:
        if con_coordenadas:
            actividad.guardar_ubicacion(db, usuario.sesion_id, "concedido", datos.latitud, datos.longitud, datos.precision_m)
        else:
            actividad.guardar_ubicacion(db, usuario.sesion_id, "no_disponible" if datos.permiso == "concedido" else datos.permiso)


@router.post("/uso")
def abrir_modulo(datos: UsoIn, usuario: UsuarioSesion = Depends(sesion_actual)):
    """La persona abrió una app o un módulo; devuelve el id para cerrar el registro al salir."""
    if datos.app not in usuario.roles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes acceso a esta aplicación")
    with engine.begin() as db:
        return {"id": actividad.abrir_modulo(db, usuario.id, usuario.sesion_id, datos.app, datos.modulo)}


@router.post("/uso/{uso_id}/fin", status_code=status.HTTP_204_NO_CONTENT)
def cerrar_modulo(uso_id: int, datos: FinUsoIn, usuario: UsuarioSesion = Depends(sesion_actual)):
    """Tiempo que estuvo en el módulo (se envía al cambiar de módulo o cerrar la pestaña)."""
    with engine.begin() as db:
        actividad.cerrar_modulo(db, usuario.id, uso_id, datos.segundos)


@router.post("/token")
def token_acceso(datos: TokenIn, usuario: UsuarioSesion = Depends(sesion_actual)):
    """Entrega un token firmado y de corta duración para el backend de una app concreta."""
    if datos.app not in usuario.roles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes acceso a esta aplicación")
    kid, llave = llaves.llave_activa()
    token = criptografia.firmar_token(kid=kid, llave=llave, emisor=settings.emisor, app=datos.app,
                                      usuario=usuario.a_dict(), minutos=settings.token_minutos)
    return {"access_token": token, "token_type": "Bearer", "expires_in": settings.token_minutos * 60}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response):
    token = request.cookies.get(settings.cookie_name)
    if token:
        with engine.begin() as db:
            usuario = sesiones.buscar(db, token)
            if usuario:
                sesiones.revocar(db, usuario.sesion_id)
    response.delete_cookie(settings.cookie_name, path="/auth")
