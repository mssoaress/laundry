import { useState } from "react";
import { useApp } from "../hooks/useApp";
import { byDate } from "../domain";
import { fmtC, fmtN, formatDate, initials } from "../format";
import {
  Action,
  Empty,
  Heading,
  Icon,
  Menu,
  Metric,
  usePagination,
} from "../components/ui";
import { ClientForm } from "../components/forms";
export function Clients() {
  const { db, account } = useApp();
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [order, setOrder] = useState("name"),
    [archived, setArchived] = useState(false),
    [creating, setCreating] = useState(false);
  const active = db.clientes.filter((c) => !c.arquivado);
  const clients = db.clientes
    .filter(
      (c) =>
        (archived || !c.arquivado) &&
        `${c.nome} ${c.tel || ""}`
          .toLocaleLowerCase("pt-BR")
          .includes(search.trim().toLocaleLowerCase("pt-BR")) &&
        (filter === "all" ||
          (filter === "pending"
            ? account(c.id).due > 0
            : account(c.id).due === 0)),
    )
    .sort((a, b) =>
      order === "balance"
        ? account(b.id).due - account(a.id).due || a.nome.localeCompare(b.nome)
        : a.nome.localeCompare(b.nome),
    );
  const pagination = usePagination(
    clients.length,
    `${search}:${filter}:${archived}`,
  );
  return (
    <>
      <Heading
        eyebrow="RELACIONAMENTOS"
        title="Seus clientes"
        subtitle="Mais clareza para cuidar de cada atendimento."
      >
        <button className="btn-add" onClick={() => setCreating(!creating)}>
          <Icon name="plus" />
          Novo cliente
        </button>
      </Heading>
      {creating && (
        <div id="form-cliente" className="form-card">
          <div className="form-card-title">Novo cliente</div>
          <ClientForm onClose={() => setCreating(false)} />
        </div>
      )}
      <div className="metrics client-summary" id="client-summary">
        <Metric
          label="Clientes ativos"
          value={fmtN(active.length)}
          hint="Na sua carteira de clientes"
        />
        <Metric
          label="Total a receber"
          value={fmtC(active.reduce((s, c) => s + account(c.id).due, 0))}
          hint="Saldo dos clientes ativos"
        />
        <Metric
          label="Clientes em dia"
          value={fmtN(active.filter((c) => account(c.id).due === 0).length)}
          tone="success"
          hint="Sem pendência financeira"
        />
      </div>
      <div className="client-directory-toolbar">
        <label className="search-field">
          <Icon name="search" />
          <input
            id="client-search"
            placeholder="Buscar por nome ou telefone..."
            aria-label="Buscar cliente"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          id="client-sort"
          aria-label="Ordenar clientes"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
        >
          <option value="name">Nome: A–Z</option>
          <option value="balance">Maior saldo a receber</option>
        </select>
      </div>
      <div className="directory-filters">
        <div className="segmented">
          {[
            ["all", "Todos"],
            ["pending", "Com pendências"],
            ["settled", "Em dia"],
          ].map(([value, label]) => (
            <button
              key={value}
              data-client-filter={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="directory-options">
          <span id="client-result-count">
            {clients.length} cliente{clients.length === 1 ? "" : "s"}
          </span>
          <label className="checkbox-label">
            <input
              type="checkbox"
              id="show-archived"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            Incluir arquivados
          </label>
        </div>
      </div>
      <div className="client-grid" id="client-list">
        {clients.length ? (
          clients.slice(0, pagination.limit).map((c) => {
            const a = account(c.id),
              entries = [...a.items.values()],
              last = entries.sort((a, b) => byDate(b, a))[0];
            return (
              <article key={c.id} className="client-card">
                <div className="client-card-top">
                  <Action className="client-identity" name="detail" id={c.id}>
                    <span className="avatar">{initials(c.nome)}</span>
                    <span>
                      <span className="client-card-name">{c.nome}</span>
                      <span className="client-card-phone">
                        {c.tel || "Sem telefone cadastrado"}
                      </span>
                    </span>
                  </Action>
                  <Menu label={`Ações de ${c.nome}`}>
                    <Action name="editClient" id={c.id} className="menu-item">
                      Editar cliente
                    </Action>
                    <Action
                      name="archiveClient"
                      id={c.id}
                      className="menu-item danger"
                    >
                      {c.arquivado ? "Restaurar cliente" : "Arquivar cliente"}
                    </Action>
                  </Menu>
                </div>
                <div className="client-status-line">
                  <span
                    className={`badge badge-${c.arquivado ? "neutral" : a.due > 0 ? "amber" : "green"}`}
                  >
                    {c.arquivado
                      ? "Arquivado"
                      : a.due > 0
                        ? "Saldo pendente"
                        : "Em dia"}
                  </span>
                  <span>{entries.length} fichas</span>
                </div>
                <div className="client-financials">
                  <div>
                    <span>A receber</span>
                    <strong>{fmtC(a.due)}</strong>
                  </div>
                  <div>
                    <span>Recebido</span>
                    <strong>{fmtC(a.received)}</strong>
                  </div>
                  <div>
                    <span>{a.credit ? "Crédito" : "Lançado"}</span>
                    <strong>{fmtC(a.credit || a.total)}</strong>
                  </div>
                </div>
                <div className="client-card-footer">
                  <span>
                    {last
                      ? `Última ficha · ${formatDate(last.data)}`
                      : "Pronto para a primeira ficha"}
                  </span>
                  <Action className="client-open" name="detail" id={c.id}>
                    Ver cliente <Icon name="arrow" />
                  </Action>
                </div>
              </article>
            );
          })
        ) : (
          <Empty>Nenhum cliente encontrado. Tente outro nome ou filtro.</Empty>
        )}
      </div>
      <div id="clients-more" className="pagination">
        {pagination.more}
      </div>
    </>
  );
}
