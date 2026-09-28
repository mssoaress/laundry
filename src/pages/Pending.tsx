import { useState } from "react";
import { useApp } from "../hooks/useApp";
import { byDate } from "../domain";
import { fmtC, formatDate } from "../format";
import {
  Action,
  ClientCell,
  Heading,
  Metric,
  SelectAll,
  toggleSelected,
  usePagination,
} from "../components/ui";
export function Pending() {
  const { db, accounts, account, operations, run } = useApp(),
    [selection, setSelection] = useState(new Set<string>()),
    all = [...accounts.values()],
    clients = db.clientes
      .filter((c) => account(c.id).due > 0)
      .sort((a, b) => account(b.id).due - account(a.id).due),
    due = all.reduce((s, a) => s + a.due, 0),
    selected = new Set(
      [...selection].filter((id) => clients.some((c) => c.id === id)),
    ),
    pagination = usePagination(clients.length),
    visible = clients.slice(0, pagination.limit);
  return (
    <>
      <Heading
        eyebrow="CONTAS A RECEBER"
        title="Pendências"
        subtitle="Acompanhe os saldos e organize os recebimentos."
      />
      <p id="pendentes-total">
        {clients.length} pendente(s) · {fmtC(due)}
      </p>
      <div className="metrics" id="pendentes-metrics">
        <Metric label="Pendentes" value={clients.length} />
        <Metric label="Saldo em aberto" value={fmtC(due)} featured />
        <Metric
          label="Total lançado"
          value={fmtC(all.reduce((s, a) => s + a.total, 0))}
        />
        <Metric
          label="Total recebido"
          value={fmtC(all.reduce((s, a) => s + a.received, 0))}
        />
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <SelectAll
                    id="chk-pend-all"
                    ids={visible.map((c) => c.id)}
                    selected={selected}
                    onChange={setSelection}
                    label="Selecionar clientes pendentes visíveis"
                  />
                </th>
                <th>Cliente</th>
                <th>Saldo a receber</th>
                <th>Última ficha</th>
                <th />
              </tr>
            </thead>
            <tbody id="tbl-pendentes">
              {visible.length ? (
                visible.map((c) => {
                  const a = account(c.id),
                    last = [...a.items.values()].sort((a, b) =>
                      byDate(b, a),
                    )[0];
                  return (
                    <tr key={c.id}>
                      <td>
                        <input
                          type="checkbox"
                          className="chk-pend"
                          data-cid={c.id}
                          aria-label={`Selecionar ${c.nome}`}
                          checked={selected.has(c.id)}
                          onChange={(e) =>
                            setSelection(
                              toggleSelected(selected, c.id, e.target.checked),
                            )
                          }
                        />
                      </td>
                      <td>
                        <ClientCell client={c} />
                      </td>
                      <td>{fmtC(a.due)}</td>
                      <td>{last ? formatDate(last.data) : "—"}</td>
                      <td>
                        <Action name="settle" id={c.id}>
                          Quitar
                        </Action>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5}>Nenhuma pendência financeira</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div id="pending-more" className="pagination">
          {pagination.more}
        </div>
      </div>
      <div
        id="pend-bulk-actions"
        className="bulk-bar"
        style={{ display: selected.size ? "flex" : "none" }}
      >
        <span id="pend-bulk-label">
          {selected.size} cliente(s) ·{" "}
          {fmtC([...selected].reduce((s, id) => s + account(id).due, 0))}
        </span>
        <button
          className="btn-primary"
          onClick={() => {
            void run("settlePending", async () => {
              await operations.markGroups(
                [...selected].map((cid) => ({
                  cid,
                  ids: [...account(cid).items.keys()],
                })),
              );
              setSelection(new Set());
            });
          }}
        >
          Quitar selecionados
        </button>
        <button className="btn-ghost" onClick={() => setSelection(new Set())}>
          Desmarcar todos
        </button>
      </div>
    </>
  );
}
