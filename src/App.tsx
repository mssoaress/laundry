import { Component, type ErrorInfo, type ReactNode } from "react";
import { AppProvider, useApp } from "./hooks/useApp";
import { Icon } from "./components/ui";
import { AccessGate } from "./components/AccessGate";
import { Modals } from "./components/Modals";
import { Dashboard } from "./pages/Dashboard";
import { Clients } from "./pages/Clients";
import { ClientDetail } from "./pages/ClientDetail";
import { Fichas } from "./pages/Fichas";
import { Reports } from "./pages/Reports";
import { Pending } from "./pages/Pending";
import { Services } from "./pages/Services";
import type { Page } from "./types";
const navigation: { id: Page; label: string; icon: string }[] = [
  { id: "dashboard", label: "Painel", icon: "dashboard" },
  { id: "clientes", label: "Clientes", icon: "users" },
  { id: "lancamentos", label: "Fichas", icon: "sheets" },
  { id: "pendentes", label: "Pendentes", icon: "pending" },
  { id: "relatorio", label: "Relatórios", icon: "chart" },
  { id: "lavados", label: "Lavados", icon: "wash" },
];
function Nav({ mobile = false }: { mobile?: boolean }) {
  const { page, navigate } = useApp();
  return (
    <nav
      className={mobile ? "bottom-nav" : "sidebar-nav"}
      aria-label={mobile ? "Navegação móvel" : "Navegação principal"}
    >
      {navigation.map((item) => (
        <button
          type="button"
          key={item.id}
          data-page={item.id}
          className={`${mobile ? "nav-item" : "sidebar-item"} ${page === item.id ? "active" : ""}`}
          aria-current={page === item.id ? "page" : undefined}
          onClick={() => navigate(item.id)}
        >
          <Icon name={item.icon} className="nav-svg" />
          {mobile ? (
            <span className="nav-label">{item.label}</span>
          ) : (
            item.label
          )}
        </button>
      ))}
    </nav>
  );
}
function Shell() {
  const {
    page,
    ready,
    loading,
    connection,
    notice,
    busy,
    modal,
    dismiss,
    reconnect,
    exportData,
  } = useApp();
  const pages: { id: Page; element: ReactNode }[] = [
    { id: "dashboard", element: <Dashboard /> },
    { id: "clientes", element: <Clients /> },
    { id: "cliente-detalhe", element: <ClientDetail /> },
    { id: "lancamentos", element: <Fichas /> },
    { id: "relatorio", element: <Reports /> },
    { id: "pendentes", element: <Pending /> },
    { id: "lavados", element: <Services /> },
  ];
  return (
    <>
      <div
        id="loading-overlay"
        className="loading-overlay"
        style={{ display: loading ? "flex" : "none" }}
      >
        <div className="loading-inner">
          <img
            src="/img/logo-nova-lavanderia.png"
            alt="Logo"
            className="loading-logo-img"
          />
          <div className="loading-spinner" />
          <p id="loading-msg">Conectando…</p>
        </div>
      </div>
      <div id="app-admin">
        <div id="app-shell" inert={!!modal}>
          <aside className="sidebar" id="sidebar">
            <div className="sidebar-brand">
              <img
                src="/img/logo-nova-lavanderia.png"
                alt="Lavanderia Emanoel"
                className="sidebar-logo-img"
              />
            </div>
            <span className="nav-caption">ESPAÇO DE GESTÃO</span>
            <Nav />
            <div className="sidebar-footer">
              <div className="workspace-badge">
                <span>LE</span>
                <div>
                  <strong>Lavanderia Emanoel</strong>
                  <small>Seu negócio, organizado.</small>
                </div>
              </div>
            </div>
          </aside>
          <header className="header">
            <div className="header-content">
              <img
                src="/img/logo-nova-lavanderia.png"
                alt="Lavanderia Emanoel"
                className="header-logo"
              />
            </div>
          </header>
          <main className="main">
            <div className="app-topbar">
              <div className="breadcrumb">
                Meu negócio <span>/</span>
                <strong id="current-page-label">
                  {page === "cliente-detalhe"
                    ? "Detalhe do cliente"
                    : page === "dashboard"
                      ? "Visão da semana"
                      : navigation.find((n) => n.id === page)?.label}
                </strong>
              </div>
              <div className="topbar-tools">
                <span id="save-status" role="status" aria-live="polite">
                  {busy ? "Salvando…" : ""}
                </span>
                <span className="connection-pill">
                  <i />
                  <span id="connection-status" role="status">
                    {connection}
                  </span>
                </span>
                <details className="utility-menu">
                  <summary aria-label="Opções do aplicativo">•••</summary>
                  <div>
                    <button id="reconnect" onClick={reconnect}>
                      Reconectar
                    </button>
                    <button
                      id="export-data"
                      onClick={exportData}
                      disabled={!ready || busy}
                    >
                      Exportar backup
                    </button>
                  </div>
                </details>
              </div>
            </div>
            {ready &&
              pages.map((p) => (
                <div
                  key={p.id}
                  id={p.id}
                  className={`page ${page === p.id ? "active" : ""}`}
                >
                  {p.element}
                </div>
              ))}
          </main>
          <Nav mobile />
        </div>
        <div className="message-wrap">
          <p
            id="app-message"
            role="status"
            aria-live="polite"
            hidden={!notice}
            className={notice?.error ? "error" : ""}
          >
            {notice?.message}
          </p>
          <button
            id="dismiss-message"
            aria-label="Fechar aviso"
            onClick={dismiss}
          >
            ×
          </button>
        </div>
        <Modals />
      </div>
    </>
  );
}
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  render() {
    return this.state.failed ? (
      <main style={{ padding: 40 }}>
        <h1>Não foi possível exibir o aplicativo</h1>
        <p>
          Recarregue a página para tentar novamente. Os dados salvos foram
          preservados.
        </p>
        <button className="btn-primary" onClick={() => location.reload()}>
          Recarregar
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ErrorBoundary>
      <AccessGate>
        <AppProvider>
          <Shell />
        </AppProvider>
      </AccessGate>
    </ErrorBoundary>
  );
}
