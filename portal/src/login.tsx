import { ApiError, login } from "@geohive/auth";
import { Marca, logo } from "@geohive/ui";
import { ArrowLeft, KeyRound, Loader2, Mail } from "lucide-react";
import { StrictMode, useEffect, useRef, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

// Solo se vuelve a rutas del mismo sitio (evita redirecciones a dominios externos)
const next = new URLSearchParams(window.location.search).get("next");
const DESTINO = next && next.startsWith("/") && !next.startsWith("//") ? next : "/#aplicaciones";
const ESPERA_REENVIO = 60;

function Login() {
  const [paso, setPaso] = useState<"correo" | "codigo">("correo");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [espera, setEspera] = useState(0);
  const inputCodigo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera(e => e - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  useEffect(() => {
    if (paso === "codigo") inputCodigo.current?.focus();
  }, [paso]);

  async function enviarCodigo(e?: FormEvent) {
    e?.preventDefault();
    setError("");
    setCargando(true);
    try {
      const r = await login.solicitarCodigo(email);
      setAviso(`${r.mensaje} El código vence en ${r.vence_en_minutos} minutos.`);
      setPaso("codigo");
      setCodigo("");
      setEspera(ESPERA_REENVIO);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? err.message : "No se pudo enviar el código. Intenta nuevamente.");
    } finally {
      setCargando(false);
    }
  }

  async function ingresar(e: FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      await login.verificarCodigo(email, codigo);
      window.location.href = DESTINO;
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? "Demasiados intentos. Espera un minuto." : (err as Error).message);
      setCargando(false);
    }
  }

  return (
    <div className="hero-gradient min-h-screen flex items-center justify-center px-5 py-10 relative overflow-hidden">
      <div className="space-bg"><div className="stars" /></div>

      <div className="relative z-10 w-full max-w-md">
        <a href="/" className="flex flex-col items-center mb-8">
          <img src={logo} alt="AG-Y GEOHIVE" className="h-20 w-auto drop-shadow-lg mb-3" />
          <Marca className="text-xl" />
        </a>

        <div className="glass-panel rounded-3xl p-8">
          <h1 className="text-lg font-black text-gold uppercase tracking-widest text-center mb-2">Acceso a la plataforma</h1>

          {paso === "correo" ? (
            <form onSubmit={enviarCodigo} className="space-y-4">
              <p className="text-sm text-gray-400 text-center mb-4">
                Escribe tu correo y te enviaremos un código de acceso.
              </p>
              <label htmlFor="email" className="text-xs text-gray-400 uppercase tracking-[0.2em]">Correo electrónico</label>
              <div className="relative">
                <Mail className="size-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input id="email" type="email" required autoFocus autoComplete="email" value={email}
                  onChange={e => setEmail(e.target.value)} className="input-field !pl-10" placeholder="nombre@empresa.com" />
              </div>
              {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
              <button disabled={cargando} className="btn-gold rounded-full w-full py-3 text-xs uppercase flex items-center justify-center gap-2">
                {cargando ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Enviar código
              </button>
            </form>
          ) : (
            <form onSubmit={ingresar} className="space-y-4">
              <p className="text-sm text-gray-400 text-center">{aviso}</p>
              <p className="text-sm text-center"><b className="text-white break-all">{email}</b></p>
              <label htmlFor="codigo" className="text-xs text-gray-400 uppercase tracking-[0.2em]">Código (4 números y 2 letras)</label>
              <input id="codigo" ref={inputCodigo} required autoComplete="one-time-code" inputMode="text"
                maxLength={7} value={codigo} placeholder="0000AA"
                onChange={e => setCodigo(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ""))}
                className="input-field text-center !text-2xl font-mono tracking-[0.5em] uppercase" />
              {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
              <button disabled={cargando || codigo.length !== 6}
                className="btn-gold rounded-full w-full py-3 text-xs uppercase flex items-center justify-center gap-2">
                {cargando ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Ingresar
              </button>
              <div className="flex justify-between text-xs text-gray-400">
                <button type="button" onClick={() => { setPaso("correo"); setError(""); }} className="hover:text-gold flex items-center gap-1">
                  <ArrowLeft className="size-3.5" /> Cambiar correo
                </button>
                <button type="button" disabled={espera > 0 || cargando} onClick={() => enviarCodigo()}
                  className="hover:text-gold disabled:opacity-50 disabled:hover:text-gray-400">
                  {espera > 0 ? `Reenviar en ${espera} s` : "Reenviar código"}
                </button>
              </div>
            </form>
          )}
        </div>

        <a href="/" className="flex items-center justify-center gap-1 mt-6 text-xs text-gray-500 hover:text-gold transition">
          <ArrowLeft className="size-3.5" /> Volver al portal
        </a>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Login />
  </StrictMode>,
);
