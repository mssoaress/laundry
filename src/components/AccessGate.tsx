import { useEffect, useState, type ReactNode } from "react";
import { signIn, watchUser, type SessionUser } from "../data/auth";
const authErrors: Record<string, string> = {
  "auth/invalid-credential": "E-mail ou senha incorretos",
  "auth/invalid-email": "E-mail ou senha incorretos",
  "auth/user-not-found": "E-mail ou senha incorretos",
  "auth/wrong-password": "E-mail ou senha incorretos",
  "auth/user-disabled": "Este acesso foi desativado.",
  "auth/too-many-requests":
    "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  "auth/network-request-failed": "Sem conexão. Verifique a internet.",
  "auth/operation-not-allowed":
    "Login por e-mail não está ativado no Firebase Authentication.",
};
const authMessage = (error: unknown) =>
  authErrors[(error as { code?: string })?.code ?? ""] ||
  "Não foi possível entrar. Tente novamente.";
// O acesso aos dados depende do usuário autenticado e das regras do Firestore.
export function AccessGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    // Remove a liberação da antiga senha local, que não protegia os dados.
    try {
      localStorage.removeItem("le_auth_ok");
    } catch {
      /* Armazenamento indisponível não impede o login. */
    }
    return watchUser(setUser);
  }, []);
  if (user) return children;
  return (
    <div id="auth-overlay" className="loading-overlay">
      <form
        className="loading-inner"
        style={{ width: "min(300px,88vw)" }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!email.trim() || !password || busy) return;
          setBusy(true);
          setError("");
          try {
            await signIn(email, password);
          } catch (failure) {
            setError(authMessage(failure));
            setPassword("");
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
        {user === undefined ? (
          <>
            <div className="loading-spinner" />
            <p>Verificando acesso…</p>
          </>
        ) : (
          <>
            <div className="form-group" style={{ width: "100%" }}>
              <label
                htmlFor="auth-email"
                style={{ color: "rgba(255,255,255,.85)" }}
              >
                E-mail
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ width: "100%" }}>
              <label
                htmlFor="auth-senha"
                style={{ color: "rgba(255,255,255,.85)" }}
              >
                Senha
              </label>
              <input
                id="auth-senha"
                type="password"
                autoComplete="current-password"
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
              {busy ? "Entrando…" : "Entrar"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
