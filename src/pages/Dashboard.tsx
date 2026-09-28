import { useApp } from "../hooks/useApp";
import { byDate, fichaCents, localDate, weeklySummary } from "../domain";
import { fmtC, fmtN, formatDate } from "../format";
import {
  Action,
  ClientCell,
  Icon,
  Metric,
  usePagination,
} from "../components/ui";
export function Dashboard() {
  const { db, clientName, navigate, newFicha } = useApp(),
    week = weeklySummary(db.lancamentos, db.pagamentos);
  const clients = [...week.clients.values()].sort(
      (a, b) => b.launched - a.launched || b.received - a.received,
    ),
    pagination = usePagination(clients.length);
  const maximum = Math.max(
      1,
      ...week.days.flatMap((day) => [day.launched, day.received]),
    ),
    weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">VISÃO GERAL</span>
          <h1 className="page-title">Painel</h1>
          <p className="page-subtitle" id="dash-date">
            De {formatDate(week.range.ini)} a {formatDate(week.range.fim)} ·
            segunda a domingo
          </p>
        </div>
        <button className="btn-ghost" onClick={() => navigate("relatorio")}>
          Ver relatórios ↗
        </button>
      </div>
      <div className="metrics" id="metrics-cards">
        <Metric
          label="Recebido na semana"
          value={fmtC(week.received)}
          featured
          hint="Pagamentos registrados no período"
        />
        <Metric
          label="Lançado na semana"
          value={fmtC(week.launched)}
          hint={`${week.entries.length} fichas registradas`}
        />
        <Metric
          label="Peças na semana"
          value={fmtN(week.pieces)}
          hint="Volume de serviços lançados"
        />
        <Metric
          label="Clientes na semana"
          value={fmtN(week.clients.size)}
          hint="Com fichas ou pagamentos no período"
        />
      </div>
      <div className="week-overview">
        <section className="card weekly-chart-card">
          <div className="panel-heading">
            <div>
              <h2>Movimento da semana</h2>
              <p>Lançamentos e recebimentos por dia</p>
            </div>
            <span id="weekly-chart-scale" className="muted">
              {fmtC(maximum === 1 ? 0 : maximum)} / dia
            </span>
          </div>
          <div className="chart-legend">
            <span>
              <i className="launched" />
              Lançado
            </span>
            <span>
              <i className="received" />
              Recebido
            </span>
          </div>
          <div id="weekly-chart" aria-hidden="true">
            {week.days.map((day, i) => (
              <div
                key={day.data}
                className={`chart-day ${day.data === localDate() ? "is-today" : ""}`}
              >
                <div className="chart-bars">
                  <div
                    className="chart-bar launched"
                    style={{ height: `${(day.launched / maximum) * 100}%` }}
                    title={`${formatDate(day.data)} · Lançado: ${fmtC(day.launched)}`}
                  />
                  <div
                    className="chart-bar received"
                    style={{ height: `${(day.received / maximum) * 100}%` }}
                    title={`${formatDate(day.data)} · Recebido: ${fmtC(day.received)}`}
                  />
                </div>
                <span>{weekdays[i]}</span>
                <small>{day.data.slice(8)}</small>
              </div>
            ))}
          </div>
          <p id="weekly-chart-accessible" className="sr-only">
            {week.days
              .map(
                (day, i) =>
                  `${weekdays[i]}: lançado ${fmtC(day.launched)}, recebido ${fmtC(day.received)}`,
              )
              .join(". ")}
          </p>
        </section>
        <aside id="weekly-highlight" className="weekly-highlight">
          <span className="eyebrow">Sua semana em foco</span>
          <h3>
            {week.entries.length
              ? `${fmtN(week.pieces)} peças nesta semana`
              : "Nenhuma ficha nesta semana"}
          </h3>
          <p>Fichas, clientes e recebimentos em um só lugar.</p>
          <button className="btn-primary" onClick={() => newFicha()}>
            <Icon name="sheets" /> Nova ficha
          </button>
        </aside>
      </div>
      <section className="card">
        <div className="panel-heading">
          <div>
            <h2>Clientes em movimento</h2>
            <p>Atividade apenas nesta semana</p>
          </div>
          <button className="text-button" onClick={() => navigate("clientes")}>
            Ver clientes →
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Fichas</th>
                <th className="number-cell">Lançado na semana</th>
                <th className="number-cell">Recebido na semana</th>
              </tr>
            </thead>
            <tbody id="tbl-aberto">
              {clients.length ? (
                clients.slice(0, pagination.limit).map((row) => (
                  <tr key={row.cid}>
                    <td>
                      <Action
                        className="table-client"
                        name="detail"
                        id={row.cid}
                      >
                        <ClientCell
                          client={
                            db.clientes.find((c) => c.id === row.cid) || {
                              id: row.cid,
                              nome: "Cliente indisponível",
                            }
                          }
                        />
                      </Action>
                    </td>
                    <td>{row.count}</td>
                    <td className="number-cell">{fmtC(row.launched)}</td>
                    <td className="number-cell text-success">
                      {fmtC(row.received)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="empty-cell">
                    Nenhuma movimentação nesta semana.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div id="dash-more" className="pagination">
          {pagination.more}
        </div>
      </section>
      <section className="card">
        <div className="panel-heading">
          <div>
            <h2>Fichas da semana</h2>
            <p>Os últimos serviços lançados no período</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Peça</th>
                <th>Quantidade</th>
                <th className="number-cell">Total</th>
              </tr>
            </thead>
            <tbody id="tbl-ultimos">
              {week.entries.length ? (
                [...week.entries]
                  .sort((a, b) => byDate(b, a))
                  .slice(0, 6)
                  .map((f) => (
                    <tr key={f.id}>
                      <td>{formatDate(f.data)}</td>
                      <td>{clientName(f.cid)}</td>
                      <td>{f.peca}</td>
                      <td>{fmtN(f.qtd)}</td>
                      <td className="number-cell">{fmtC(fichaCents(f))}</td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    Nenhuma ficha nesta semana.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
