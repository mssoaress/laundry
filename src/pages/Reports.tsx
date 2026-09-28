import { useState } from "react";
import { useApp } from "../hooks/useApp";
import { fichaCents, paymentCents, validDate, weekRange } from "../domain";
import { fmtC, fmtN, MONTHS } from "../format";
import {
  Action,
  ClientCell,
  Empty,
  Heading,
  Metric,
  SelectAll,
  toggleSelected,
  usePagination,
} from "../components/ui";
import { useYears } from "./Fichas";
import type { DateRange } from "../types";
export function Reports() {
  const { db, account, run, operations } = useApp(),
    years = useYears(),
    [period, setPeriod] = useState("mensal"),
    [year, setYear] = useState(String(new Date().getFullYear())),
    [month, setMonth] = useState(
      String(new Date().getMonth() + 1).padStart(2, "0"),
    ),
    [start, setStart] = useState(weekRange().ini),
    [end, setEnd] = useState(weekRange().fim),
    [selection, setSelection] = useState(new Set<string>());
  const range: DateRange | null =
    period === "todos"
      ? { ini: "0000-01-01", fim: "9999-12-31" }
      : period === "mensal"
        ? { ini: `${year}-${month}-01`, fim: `${year}-${month}-31` }
        : validDate(start) && validDate(end) && start <= end
          ? { ini: start, fim: end }
          : null;
  const within = (row: { data: string }) =>
    !!range && row.data >= range.ini && row.data <= range.fim;
  const fichas = db.lancamentos.filter((f) => !f.cancelada && within(f)),
    payments = db.pagamentos.filter((p) => !p.estornado && within(p));
  const grouped = new Map<
    string,
    { pcs: number; total: number; received: number }
  >();
  for (const f of fichas) {
    const row = grouped.get(f.cid) || { pcs: 0, total: 0, received: 0 };
    row.pcs += Number(f.qtd);
    row.total += fichaCents(f);
    grouped.set(f.cid, row);
  }
  for (const p of payments) {
    const row = grouped.get(p.cid) || { pcs: 0, total: 0, received: 0 };
    row.received += paymentCents(p);
    grouped.set(p.cid, row);
  }
  const clients = db.clientes
      .filter((c) => grouped.has(c.id))
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    selected = new Set([...selection].filter((id) => grouped.has(id))),
    pagination = usePagination(
      clients.length,
      `${period}:${year}:${month}:${start}:${end}`,
    ),
    visible = clients.slice(0, pagination.limit),
    maximum = Math.max(1, ...[...grouped.values()].map((g) => g.pcs));
  function clear() {
    setSelection(new Set());
  }
  return (
    <>
      <Heading
        eyebrow="RESULTADOS"
        title="Relatórios"
        subtitle="Consulte o histórico e acompanhe seus resultados."
      />
      <div className="relatorio-filtros">
        <div className="filtro-tabs">
          {[
            ["mensal", "Mensal"],
            ["semanal", "Semanal"],
            ["todos", "Todo o histórico"],
          ].map(([p, label]) => (
            <button
              key={p}
              className={`filtro-tab ${p === period ? "active" : ""}`}
              data-periodo={p}
              onClick={() => {
                setPeriod(p);
                clear();
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          className="filtro-controles"
          id="controles-mensal"
          style={{ display: period === "mensal" ? "flex" : "none" }}
        >
          <select
            id="r-mes"
            aria-label="Mês do relatório"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              clear();
            }}
          >
            {MONTHS.map((m, i) => (
              <option value={String(i + 1).padStart(2, "0")} key={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            id="r-ano"
            aria-label="Ano do relatório"
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              clear();
            }}
          >
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>
        <div
          className="filtro-controles"
          id="controles-semanal"
          style={{ display: period === "semanal" ? "flex" : "none" }}
        >
          <input
            id="r-semana-inicio"
            aria-label="Início do período"
            type="date"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              clear();
            }}
          />
          <span className="filtro-sep">até</span>
          <input
            id="r-semana-fim"
            aria-label="Fim do período"
            type="date"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              clear();
            }}
          />
        </div>
      </div>
      <div className="metrics" id="r-metrics">
        {range ? (
          <>
            <Metric
              label="Recebido no período"
              value={fmtC(payments.reduce((s, p) => s + paymentCents(p), 0))}
              featured
            />
            <Metric
              label="Lançado no período"
              value={fmtC(fichas.reduce((s, f) => s + fichaCents(f), 0))}
            />
            <Metric
              label="Peças lavadas"
              value={fmtN(fichas.reduce((s, f) => s + Number(f.qtd), 0))}
            />
          </>
        ) : (
          <Empty>Selecione um período válido.</Empty>
        )}
      </div>
      <div className="section-label">Peças por cliente</div>
      <div className="card">
        <div id="r-barras" style={{ padding: "4px 0" }}>
          {visible.some((c) => grouped.get(c.id)!.pcs) ? (
            visible
              .filter((c) => grouped.get(c.id)!.pcs)
              .map((c) => (
                <div className="bar-row" key={c.id}>
                  <div className="bar-label" title={c.nome}>
                    {c.nome}
                  </div>
                  <div className="bar-wrap">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.round((grouped.get(c.id)!.pcs / maximum) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="bar-value">
                    {fmtN(grouped.get(c.id)!.pcs)}
                  </div>
                </div>
              ))
          ) : (
            <Empty>Sem peças no período</Empty>
          )}
        </div>
      </div>
      <div className="section-label">Detalhamento</div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <SelectAll
                    id="chk-all"
                    ids={visible.map((c) => c.id)}
                    selected={selected}
                    onChange={setSelection}
                    label="Selecionar clientes visíveis no relatório"
                  />
                </th>
                <th>Cliente</th>
                <th>Peças</th>
                <th>Lançado</th>
                <th>Recebido</th>
                <th>Saldo geral a receber</th>
                <th />
              </tr>
            </thead>
            <tbody id="tbl-relatorio">
              {visible.length ? (
                visible.map((c) => {
                  const row = grouped.get(c.id)!;
                  return (
                    <tr key={c.id}>
                      <td>
                        <input
                          type="checkbox"
                          className="chk-rel"
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
                      <td>{fmtN(row.pcs)}</td>
                      <td>{fmtC(row.total)}</td>
                      <td>{fmtC(row.received)}</td>
                      <td>{fmtC(account(c.id).due)}</td>
                      <td>
                        <Action name="payment" id={c.id}>
                          Pagamento
                        </Action>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>Nenhum movimento neste período</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div id="report-more" className="pagination">
          {pagination.more}
        </div>
      </div>
      <div
        className="bulk-bar"
        id="bulk-actions"
        style={{ display: selected.size ? "flex" : "none" }}
      >
        <span id="bulk-label">
          {selected.size} cliente(s) · fichas do período
        </span>
        <button
          className="btn-primary"
          onClick={() => {
            void run("settleReport", async () => {
              if (!range) throw new Error("Selecione um período válido.");
              await operations.markGroups(
                [...selected].map((cid) => ({
                  cid,
                  ids: fichas.filter((f) => f.cid === cid).map((f) => f.id),
                })),
              );
              clear();
            });
          }}
        >
          Quitar fichas do período
        </button>
        <button className="btn-ghost" onClick={clear}>
          Desmarcar todos
        </button>
      </div>
    </>
  );
}
