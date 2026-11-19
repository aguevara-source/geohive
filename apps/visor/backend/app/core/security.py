"""Validación de los tokens emitidos por el servicio de autenticación (services/auth).

Cada petición debe traer `Authorization: Bearer <token>`. Se verifica:
firma (llaves públicas JWKS), expiración, emisor, audiencia (= esta app) y rol.
"""
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Usuario:
    id: str
    usuario: str
    nombre: str
    roles: tuple[str, ...]


@lru_cache
def jwks_client() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(settings.auth_jwks_url, cache_keys=True, lifespan=3600)


def _no_autorizado(detalle: str) -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detalle, headers={"WWW-Authenticate": "Bearer"})


def validar_token(token: str) -> dict:
    try:
        llave = jwks_client().get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            llave,
            algorithms=["RS256"],
            audience=settings.client_id,
            issuer=settings.auth_issuer,
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.PyJWKClientConnectionError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Servicio de autenticación no disponible")
    except jwt.PyJWTError:
        raise _no_autorizado("Token inválido o expirado")


def usuario_actual(cred: HTTPAuthorizationCredentials | None = Depends(bearer)) -> Usuario:
    if cred is None:
        raise _no_autorizado("Se requiere iniciar sesión")
    claims = validar_token(cred.credentials)
    roles = tuple(claims.get("roles", []))
    if settings.rol_requerido not in roles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes acceso a esta aplicación")
    return Usuario(
        id=claims["sub"],
        usuario=claims.get("preferred_username", ""),
        nombre=claims.get("name") or claims.get("preferred_username", ""),
        roles=roles,
    )
