/**
 * @geohive/auth — sesión única para todas las apps GeoHive (servicio services/auth).
 *
 *   <AuthProvider config={{ app: "visor" }}>
 *     <RequireRole role="visor" fallback={<SinAcceso />}>
 *       <App />
 *     </RequireRole>
 *   </AuthProvider>
 *
 * - Sin sesión: redirige a /login/ (correo → código de 4 dígitos y 2 letras) y vuelve a la app.
 * - La sesión es una cookie httpOnly que solo viaja a /auth; JavaScript no puede leerla.
 * - Para hablar con su backend, la app pide un token corto (5 min) firmado y válido solo para ella.
 * - Actividad: tras el login el navegador pide permiso para guardar la ubicación del ingreso (tabla
 *   auth.ingresos), y useModulo("geomarketing") registra qué módulo se usa y por cuánto tiempo (auth.uso_modulos).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export interface AuthConfig {
  /** Id de la app: igual al rol que la habilita y a la audiencia del token */
  app: string;
  /** Base del servicio de autenticación. Por defecto: /auth */
  url?: string;
  /** Página de inicio de sesión. Por defecto: /login/ */
  loginUrl?: string;
}

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  roles: string[];
  /** La sesión aún no guardó desde dónde se ingresó */
  ubicacion_pendiente?: boolean;
}

interface AuthContextValue {
  usuario: Usuario;
  hasRole: (rol: string) => boolean;
  getToken: () => Promise<string>;
  logout: () => Promise<void>;
  /** Registra que la persona está usando este módulo de la app (ver useModulo) */
  registrarModulo: (modulo: string) => void;
}

/** Módulo abierto: el tiempo solo corre mientras la pestaña está visible */
interface UsoAbierto {
  modulo: string;
  id: number | null;
  acumuladoMs: number;
  desde: number | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function leerError(r: Response) {
  try {
    const cuerpo = await r.json();
    if (typeof cuerpo.detail === "string") return cuerpo.detail;
  } catch {
    /* respuesta sin JSON */
  }
  return `Error ${r.status}`;
}

export function irAlLogin(loginUrl = "/login/") {
  const volver = window.location.pathname + window.location.search + window.location.hash;
  window.location.href = `${loginUrl}?next=${encodeURIComponent(volver)}`;
}

export function AuthProvider({ config, children, loading = null, error = null }: {
  config: AuthConfig;
  children: ReactNode;
  loading?: ReactNode;
  error?: ReactNode;
}) {
  const base = config.url ?? "/auth";
  const loginUrl = config.loginUrl ?? "/login/";
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [fallo, setFallo] = useState(false);
  const cache = useRef<{ token: string; vence: number } | null>(null);
  const pendiente = useRef<Promise<string> | null>(null);
  const uso = useRef<UsoAbierto | null>(null);

  useEffect(() => {
    fetch(`${base}/sesion`, { credentials: "same-origin" })
      .then(async r => {
        if (r.status === 401) return irAlLogin(loginUrl);
        if (!r.ok) throw new Error(await leerError(r));
        setUsuario(await r.json());
      })
      .catch(() => setFallo(true));
  }, [base, loginUrl]);

  // Ubicación del ingreso: se pide una vez por sesión (el navegador muestra su propio aviso de permiso)
  const ubicacionPendiente = usuario?.ubicacion_pendiente ?? false;
  useEffect(() => {
    if (!ubicacionPendiente) return;
    const enviar = (cuerpo: object) => { enviarJson(`${base}/ubicacion`, cuerpo); };
    if (!navigator.geolocation) return enviar({ permiso: "no_disponible" });
    navigator.geolocation.getCurrentPosition(
      p => enviar({ permiso: "concedido", latitud: p.coords.latitude, longitud: p.coords.longitude, precision_m: p.coords.accuracy }),
      e => enviar({ permiso: e.code === e.PERMISSION_DENIED ? "denegado" : "no_disponible" }),
      { enableHighAccuracy: false, timeout: 20_000, maximumAge: 300_000 },
    );
  }, [ubicacionPendiente, base]);

  const cerrarUso = useCallback((salida: boolean) => {
    const u = uso.current;
    if (!u || u.id === null) return Promise.resolve();
    const ms = u.acumuladoMs + (u.desde !== null ? Date.now() - u.desde : 0);
    return enviarJson(`${base}/uso/${u.id}/fin`, { segundos: Math.min(86_400, Math.round(ms / 1000)) }, salida);
  }, [base]);

  const registrarModulo = useCallback((modulo: string) => {
    if (uso.current?.modulo === modulo) return;
    cerrarUso(false);
    const nuevo: UsoAbierto = { modulo, id: null, acumuladoMs: 0, desde: document.hidden ? null : Date.now() };
    uso.current = nuevo;
    fetch(`${base}/uso`, {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app: config.app, modulo }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then((d: { id: number } | null) => { nuevo.id = d?.id ?? null; })
      .catch(() => undefined);
  }, [base, config.app, cerrarUso]);

  // Al ocultar o cerrar la pestaña se guarda el tiempo acumulado; al volver, sigue contando
  useEffect(() => {
    const cambio = () => {
      const u = uso.current;
      if (!u) return;
      if (document.hidden) {
        if (u.desde !== null) u.acumuladoMs += Date.now() - u.desde;
        u.desde = null;
        cerrarUso(true);
      } else if (u.desde === null) {
        u.desde = Date.now();
      }
    };
    const salir = () => { if (!document.hidden) cambio(); };
    document.addEventListener("visibilitychange", cambio);
    window.addEventListener("pagehide", salir);
    return () => {
      document.removeEventListener("visibilitychange", cambio);
      window.removeEventListener("pagehide", salir);
    };
  }, [cerrarUso]);

  const getToken = useCallback(async () => {
    if (cache.current && cache.current.vence - Date.now() > 30_000) return cache.current.token;
    // Una sola petición aunque varios componentes pidan el token a la vez
    pendiente.current ??= (async () => {
      try {
        const r = await fetch(`${base}/token`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app: config.app }),
        });
        if (r.status === 401) {
          irAlLogin(loginUrl);
          throw new ApiError(401, "Sesión vencida");
        }
        if (!r.ok) throw new ApiError(r.status, await leerError(r));
        const datos: { access_token: string; expires_in: number } = await r.json();
        cache.current = { token: datos.access_token, vence: Date.now() + datos.expires_in * 1000 };
        return datos.access_token;
      } finally {
        pendiente.current = null;
      }
    })();
    return pendiente.current;
  }, [base, loginUrl, config.app]);

  const value = useMemo<AuthContextValue | null>(() => usuario && {
    usuario,
    hasRole: rol => usuario.roles.includes(rol),
    getToken,
    logout: async () => {
      await cerrarUso(false);  // antes de cerrar la sesión, si no el servidor ya no lo acepta
      await fetch(`${base}/logout`, { method: "POST", credentials: "same-origin" }).catch(() => undefined);
      window.location.href = "/";
    },
    registrarModulo,
  }, [usuario, getToken, base, registrarModulo, cerrarUso]);

  if (fallo) return <>{error}</>;
  if (!value) return <>{loading}</>;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

/**
 * Registra el módulo que la persona está usando, para el reporte de módulos más usados.
 *   useModulo(pestanaActiva)   // "capas", "geomarketing", "lotes"...
 */
export function useModulo(modulo: string | null | undefined) {
  const { registrarModulo } = useAuth();
  useEffect(() => {
    if (modulo) registrarModulo(modulo);
  }, [modulo, registrarModulo]);
}

/** POST con JSON que no bloquea; con «salida», sobrevive al cierre de la pestaña (sendBeacon). */
function enviarJson(url: string, cuerpo: object, salida = false): Promise<void> {
  const json = JSON.stringify(cuerpo);
  if (salida && navigator.sendBeacon?.(url, new Blob([json], { type: "application/json" }))) return Promise.resolve();
  return fetch(url, {
    method: "POST", credentials: "same-origin", keepalive: salida,
    headers: { "Content-Type": "application/json" }, body: json,
  }).then(() => undefined, () => undefined);
}

/** Muestra el contenido solo si el usuario tiene el rol (el backend valida lo mismo). */
export function RequireRole({ role, children, fallback }: { role: string; children: ReactNode; fallback: ReactNode }) {
  const { hasRole } = useAuth();
  return <>{hasRole(role) ? children : fallback}</>;
}

/** Cliente HTTP que agrega el token Bearer a cada petición al backend de la app. */
export function useApi(baseUrl: string) {
  const { getToken } = useAuth();

  return useCallback(
    async <T,>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> => {
      const { json, headers, ...resto } = init;
      const pedir = async () => fetch(baseUrl + path, {
        ...resto,
        headers: {
          Authorization: `Bearer ${await getToken()}`,
          ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: json !== undefined ? JSON.stringify(json) : resto.body,
      });
      let r = await pedir();
      // Lecturas: si el servidor falla de forma transitoria (502/503/504), se reintenta una vez
      if ((resto.method ?? "GET") === "GET" && [502, 503, 504].includes(r.status)) {
        await new Promise(listo => setTimeout(listo, 800));
        r = await pedir();
      }
      if (!r.ok) throw new ApiError(r.status, await leerError(r));
      const tipo = r.headers.get("content-type") ?? "";
      return (tipo.includes("json") ? r.json() : r.blob()) as Promise<T>;
    },
    [baseUrl, getToken],
  );
}

// ---------- Llamadas usadas por la página de inicio de sesión ----------

async function post(url: string, cuerpo: unknown) {
  const r = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  if (!r.ok) throw new ApiError(r.status, await leerError(r));
  return r.json();
}

export const login = {
  solicitarCodigo: (email: string, base = "/auth") =>
    post(`${base}/codigo`, { email }) as Promise<{ mensaje: string; vence_en_minutos: number }>,
  verificarCodigo: (email: string, codigo: string, base = "/auth") =>
    post(`${base}/verificar`, { email, codigo }) as Promise<{ ok: true }>,
};
