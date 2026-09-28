import { useEffect, useState } from "react";
import { useApp } from "../hooks/useApp";
import { byDate, cents, fichaCents } from "../domain";
import { fmtC, formatDate, initials } from "../format";
import {
  Action,
  Empty,
  Icon,
  Menu,
  Metric,
  usePagination,
} from "../components/ui";
import { FichaCard } from "../components/FichaCard";
import type { DetailTab, FichaItem } from "../types";
function FichaList({
  items,
  id,
  moreId,
  empty,
}: {
  items: FichaItem[];
  id: string;
  moreId: string;
  empty: string;
}) {
  const { limit, more } = usePagination(items.length);
  return (
    <>
      <div id={id}>
        {items.length ? (
          items
            .slice(0, limit)
            .map((f) => <FichaCard key={f.id} item={f} detail />)
        ) : (
          <Empty>{empty}</Empty>
        )}
      </div>
      <div id={moreId} className="pagination">
        {more}
      </div>
    </>
  );
}
export function ClientDetail() {
  const { db, clientId, account, navigate } = useApp(),
    [tab, setTab] = useState<DetailTab>("open");
  useEffect(() => setTab("open"), [clientId]);
  const c = db.clientes.find((c) => c.id === clientId),
    a = account(clientId),
    items = [...a.items.values()].sort((a, b) => byDate(b, a)),
    open = items.filter((f) => !f.settled),
    paid = items.filter((f) => f.settled),
    payments = [...a.pagamentos].sort((a, b) => byDate(b, a)),
    canceled = a.fichas.filter((f) => f.cancelada),
    pagination = usePagination(payments.length, clientId);
  const tabs: { key: DetailTab; label: string; count: number }[] = [
    { key: "open", label: "Em aberto", count: open.length },
    { key: "paid", label: "Pagas", count: paid.length },
    {
      key: "payments",
      label: "Pagamentos",
      count: payments.filter((p) => !p.estornado).length,
    },
    { key: "history", label: "Histórico", count: items.length },
  ];
  if (!c)
    return (
      <Empty>
        Cliente indisponível.{" "}
        <button onClick={() => navigate("clientes")}>
          Voltar aos clientes
        </button>
      </Empty>
    );
  return (
    <>
      <button className="btn-back" onClick={() => navigate("clientes")}>
        ← Todos os clientes
      </button>
      <div className="detalhe-header" id="detalhe-header">
        <div className="detail-identity">
          <div className="detalhe-avatar">{initials(c.nome)}</div>
          <div>
            <div className="detail-name-line">
              <h1 className="detalhe-nome">{c.nome}</h1>
              <span
                className={`badge ${c.arquivado ? "badge-neutral" : a.due > 0 ? "badge-amber" : "badge-green"}`}
              >
                {c.arquivado
                  ? "Arquivado"
                  : a.due > 0
                    ? "Saldo pendente"
                    : "Em dia"}
              </span>
            </div>
            <div className="detalhe-tel">
              <Icon name="phone" />
              {c.tel || "Sem telefone cadastrado"} <span>·</span> {items.length}{" "}
              fichas
            </div>
          </div>
        </div>
        <div className="detail-actions">
          <Action name="selectNote" id={c.id} className="btn-ghost">
            <Icon name="print" />
            Imprimir nota
          </Action>
          <Action name="payment" id={c.id} className="btn-primary">
            Registrar pagamento
          </Action>
          <Menu label="Mais ações do cliente">
            <Action name="editClient" id={c.id} className="menu-item">
              Editar cliente
            </Action>
            {!c.arquivado && (
              <Action name="newFicha" id={c.id} className="menu-item">
                Nova ficha
              </Action>
            )}
            <Action name="archiveClient" id={c.id} className="menu-item danger">
              {c.arquivado ? "Restaurar cliente" : "Arquivar cliente"}
            </Action>
          </Menu>
        </div>
      </div>
      <div className="detalhe-resumo" id="detalhe-resumo">
        <Metric label="Saldo a receber" value={fmtC(a.due)} featured />
        <Metric
          label="Total recebido"
          value={fmtC(a.received)}
          tone="success"
        />
        <Metric
          label={a.credit ? "Crédito disponível" : "Total lançado"}
          value={fmtC(a.credit || a.total)}
        />
      </div>
      <div id="detail-help" className="account-info">
        <Icon name={a.available > 0 ? "wallet" : "check"} />
        <span>
          {a.available > 0 ? (
            <>
              <strong>{fmtC(a.available)} em pagamentos disponíveis.</strong> Ao
              marcar uma ficha como paga, esse valor é aproveitado antes de
              registrar um novo recebimento.
            </>
          ) : (
            "Ao marcar como paga, a ficha é quitada e sai automaticamente da nota."
          )}
        </span>
      </div>
      <div
        id="detail-tabs"
        className="detail-tabs"
        role="tablist"
        aria-label="Informações do cliente"
        onKeyDown={(e) => {
          const idx = tabs.findIndex((t) => t.key === tab),
            next =
              e.key === "ArrowRight"
                ? (idx + 1) % 4
                : e.key === "ArrowLeft"
                  ? (idx + 3) % 4
                  : e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? 3
                      : -1;
          if (next >= 0) {
            e.preventDefault();
            setTab(tabs[next].key);
            e.currentTarget
              .querySelectorAll<HTMLButtonElement>("button")
              [next].focus();
          }
        }}
      >
        {tabs.map((t) => (
          <button
            role="tab"
            id={`detail-tab-${t.key}`}
            key={t.key}
            data-detail-tab={t.key}
            aria-controls={`detail-panel-${t.key}`}
            aria-selected={tab === t.key}
            tabIndex={tab === t.key ? 0 : -1}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span id={`detail-count-${t.key}`}>{t.count}</span>
          </button>
        ))}
      </div>
      <div className="detail-content">
        <section
          id="detail-panel-open"
          data-detail-panel="open"
          role="tabpanel"
          aria-labelledby="detail-tab-open"
          hidden={tab !== "open"}
        >
          <div className="detail-panel-heading">
            <h2>Fichas em aberto</h2>
            <p>Marque como paga com um clique.</p>
          </div>
          <FichaList
            key={`${c.id}:open`}
            items={open}
            id="detalhe-fichas-abertas"
            moreId="detail-open-more"
            empty="Todas as fichas estão marcadas como pagas"
          />
        </section>
        <section
          id="detail-panel-paid"
          data-detail-panel="paid"
          role="tabpanel"
          aria-labelledby="detail-tab-paid"
          hidden={tab !== "paid"}
        >
          <div className="detail-panel-heading">
            <h2>Fichas pagas</h2>
            <p>Estas fichas não entram nas notas.</p>
          </div>
          <FichaList
            key={`${c.id}:paid`}
            items={paid}
            id="detalhe-fichas-pagas"
            moreId="detail-paid-more"
            empty="As fichas quitadas aparecerão aqui."
          />
        </section>
        <section
          id="detail-panel-payments"
          data-detail-panel="payments"
          role="tabpanel"
          aria-labelledby="detail-tab-payments"
          hidden={tab !== "payments"}
        >
          <div className="detail-panel-heading">
            <h2>Pagamentos registrados</h2>
          </div>
          <div id="detalhe-pagamentos">
            {payments.length ? (
              payments.slice(0, pagination.limit).map((p) => (
                <div
                  className={`pgto-card ${p.estornado ? "reversed" : ""}`}
                  key={p.id}
                >
                  <div>
                    <div className="pgto-card-info">
                      {p.estornado
                        ? "Pagamento estornado"
                        : "Pagamento registrado"}
                    </div>
                    <div className="pgto-card-data">
                      {formatDate(p.data)}
                      {p.motivoEstorno && ` · ${p.motivoEstorno}`}
                    </div>
                  </div>
                  <div>
                    <span className="pgto-card-valor">
                      {fmtC(cents(p.valor))}
                    </span>
                    {!p.estornado && (
                      <Action
                        name="reverse"
                        id={p.id}
                        className="btn-danger-sm"
                      >
                        Estornar
                      </Action>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <Empty>Nenhum pagamento registrado</Empty>
            )}
          </div>
          <div className="pagination" id="detail-payments-more">
            {pagination.more}
          </div>
        </section>
        <section
          id="detail-panel-history"
          data-detail-panel="history"
          role="tabpanel"
          aria-labelledby="detail-tab-history"
          hidden={tab !== "history"}
        >
          <div className="detail-panel-heading">
            <h2>Histórico de fichas</h2>
          </div>
          <FichaList
            key={`${c.id}:all`}
            items={items}
            id="detalhe-todas-fichas"
            moreId="detail-all-more"
            empty="Nenhuma ficha"
          />
          <div id="cancelled-fichas">
            {canceled.length > 0 && (
              <details>
                <summary>{canceled.length} ficha(s) cancelada(s)</summary>
                {canceled.map((f) => (
                  <p key={f.id}>
                    {f.peca} · {formatDate(f.data)} · {fmtC(fichaCents(f))}{" "}
                    <Action name="restoreFicha" id={f.id} className="btn-ghost">
                      Restaurar
                    </Action>
                  </p>
                ))}
              </details>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
