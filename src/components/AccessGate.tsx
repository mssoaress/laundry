import { useState, type ReactNode } from "react";
const AUTH_KEY = "le_auth_ok";
const AUTH_HASH =
  "2cddab7030321d19487e561e20e52c3b80e09f0b98c7361e6b1a3dc3e5a8a241";
// Fluxo local legado preservado. Autorização no Firebase será tratada separadamente.
export function AccessGate({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState(
      () => localStorage.getItem(AUTH_KEY) === "1",
    ),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (allowed) return children;
  return (
    <div id="auth-overlay" className="loading-overlay">
      <form
        className="loading-inner"
        style={{ width: "min(280px,88vw)" }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!password.trim() || busy) return;
          setBusy(true);
          try {
            const digest = await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(password.trim()),
            );
            const hash = Array.from(new Uint8Array(digest))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
            if (hash === AUTH_HASH) {
              localStorage.setItem(AUTH_KEY, "1");
              setAllowed(true);
            } else {
              setError("Senha incorreta");
              setPassword("");
            }
          } catch {
            setError("Não foi possível validar o acesso. Recarregue a página.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <img
          src="/img/logo-nova-lavanderia.png"
          alt="Lavanderia Emanoel"
          className="loading-logo-img"
        />
        <div className="form-group" style={{ width: "100%" }}>
          <label
            htmlFor="auth-senha"
            style={{ color: "rgba(255,255,255,.85)" }}
          >
            Senha de acesso
          </label>
          <input
            id="auth-senha"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            autoFocus
            style={{
              textAlign: "center",
              fontSize: "1.1rem",
              letterSpacing: ".3em",
            }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div
          id="auth-erro"
          role="alert"
          style={{ color: "#ffb4b4", fontSize: ".8rem", minHeight: "1em" }}
        >
          {error}
        </div>
        <button
          className="btn-primary"
          id="auth-btn"
          style={{ width: "100%" }}
          disabled={busy}
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
