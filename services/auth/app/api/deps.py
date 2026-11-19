from fastapi import Depends, HTTPException, Request, status

from ..core.config import settings
from ..db.session import engine
from ..services import sesiones
from ..services.sesiones import UsuarioSesion


def ip_cliente(request: Request) -> str | None:
    return request.client.host if request.client else None


def sesion_actual(request: Request) -> UsuarioSesion:
    token = request.cookies.get(settings.cookie_name)
    usuario = None
    if token:
        with engine.begin() as db:
            usuario = sesiones.buscar(db, token)
    if not usuario:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sesión no iniciada o vencida")
    return usuario


def requiere_admin(usuario: UsuarioSesion = Depends(sesion_actual)) -> UsuarioSesion:
    if settings.rol_admin not in usuario.roles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Requiere permisos de administrador")
    return usuario
