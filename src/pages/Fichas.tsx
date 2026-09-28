import { useState } from "react";
import { useApp } from "../hooks/useApp";
import { byDate, fichaCents } from "../domain";
import { fmtC, fmtN, MONTHS } from "../format";
import { Empty, Heading, Icon, usePagination } from "../components/ui";
import { FichaForm } from "../components/forms";
import { FichaCard } from "../components/FichaCard";
export function useYears() {
  const { db } = useApp();
  return [
    ...new Set(
      [
        String(new Date().getFullYear()),
        ...db.lancamentos.map((f) => f.data?.slice(0, 4)),
        ...db.pagamentos.map((p) => p.data?.slice(0, 4)),
      ].filter(Boolean),
    ),
  ]
    .sort()
    .reverse();
}
export function Fichas() {
  const { db, account, newFichaClient, setNewFichaClient } = useApp(),
    [client, setClient] = useState(""),
    [month, setMonth] = useState(""),
    [year, setYear] = useState(""),
    years = useYears();
  const list = db.lancamentos
      .filter(
        (f) =>
          !f.cancelada &&
          (!client || f.cid === client) &&
          (!month || f.data.slice(5, 7) === month) &&
          (!year || f.data.slice(0, 4) === year),
      )
      .sort((a, b) => byDate(b, a)),
    pagination = usePagination(list.length, `${client}:${month}:${year}`);
  return (
    <>
      <Heading
        eyebrow="SERVIÇOS REALIZADOS"
        title="Fichas de serviço"
        subtitle="Cada peça, cada serviço, tudo no lugar."
      >
        <button
          className="btn-add"
          onClick={() => setNewFichaClient(newFichaClient === null ? "" : null)}
        >
          <Icon name="plus" />
          Nova ficha
        </button>
      </Heading>
      {newFichaClient !== null && (
        <div className="form-card" id="form-lanc">
          <div className="form-card-title">Nova ficha</div>
          <FichaForm
            key={newFichaClient}
            initialClient={newFichaClient}
            onClose={() => setNewFichaClient(null)}
          />
        </div>
      )}
      <div className="filter-bar">
        <select
          id="f-cliente"
          aria-label="Filtrar cliente"
          value={client}
          onChange={(e) => setClient(e.target.value)}
        >
          <option value="">Todos os clientes</option>
          {db.clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
              {c.arquivado ? " (arquivado)" : ""}
            </option>
          ))}
        </select>
        <select
          id="f-ano"
          aria-label="Ano das fichas"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          <option value="">Todos os anos</option>
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
        <select
          id="f-mes"
          aria-label="Filtrar mês"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        >
          <option value="">Todos os meses</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2, "0")}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div id="lanc-list">
        {list.length ? (
          list
            .slice(0, pagination.limit)
            .map((f) => (
              <FichaCard key={f.id} item={account(f.cid).items.get(f.id)!} />
            ))
        ) : (
          <Empty>Nenhuma ficha encontrada</Empty>
        )}
      </div>
      <div id="fichas-more">
        <p className="list-total">
          {fmtN(list.reduce((s, f) => s + Number(f.qtd), 0))} peças ·{" "}
          {fmtC(list.reduce((s, f) => s + fichaCents(f), 0))}
        </p>
        {pagination.more}
      </div>
    </>
  );
}
