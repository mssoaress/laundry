import test from "node:test";
import assert from "node:assert/strict";
import {
  cents,
  moneyInput,
  localDate,
  validDate,
  validateFicha,
} from "../src/domain/index.ts";
test("dinheiro é convertido em centavos exatos", () => {
  assert.equal(cents(0.1) * 3, cents(0.3));
  assert.equal(moneyInput("3,30"), 330);
});
test("rejeita valores negativos, infinitos e precisão excessiva", () => {
  for (const v of ["-1", "Infinity", "1.234", "", "abc"])
    assert.throws(() => moneyInput(v));
});
test("quantidade é um inteiro positivo", () => {
  for (const qtd of [-1, 0, 1.2, Infinity])
    assert.throws(() =>
      validateFicha({
        peca: "Calça",
        data: "2026-09-24",
        qtd,
        valor: "3.50",
        lavado: "Marmorizado",
      }),
    );
});
test("datas inválidas são rejeitadas", () => {
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2024-02-29"), true);
});
test("data local não muda à noite", () => {
  process.env.TZ = "America/Fortaleza";
  assert.equal(localDate(new Date("2026-09-24T22:30:00-03:00")), "2026-09-24");
});
import { statement, markPaidPlan, noteItems } from "../src/domain/index.ts";
const fichas = [
  { id: "f1", qtd: 1, valor: 100, data: "2026-01-01" },
  { id: "f2", qtd: 1, valor: 100, data: "2026-02-01" },
];
test("pagamentos antigos não marcam automaticamente as fichas", () => {
  const s = statement(fichas, [{ id: "p1", valor: 150, data: "2026-01-01" }]);
  assert.equal(s.available, 15000);
  assert.equal(noteItems(fichas, [{ id: "p1", valor: 150 }]).length, 2);
  assert.equal(s.due, 5000);
});
test("marcação usa recebimentos existentes sem duplicar receita", () => {
  const plan = markPaidPlan(fichas, [{ id: "p1", valor: 150 }], ["f2"]);
  assert.equal(plan.newAmount, 0);
  assert.equal(plan.reused, 10000);
  assert.equal(plan.updates[0].alocacoes[0].fid, "f2");
});
test("marcação registra apenas a diferença e exclui paga da nota", () => {
  const p = [{ id: "p1", valor: 50 }];
  const plan = markPaidPlan(fichas, p, ["f1"]);
  assert.equal(plan.newAmount, 5000);
  const paid = [
    ...plan.updates,
    { id: "p2", valor: 50, alocacoes: plan.allocations },
  ];
  const updated = fichas.map((f) => ({ ...f, paga: f.id === "f1" }));
  assert.deepEqual(
    noteItems(updated, paid).map((f) => f.id),
    ["f2"],
  );
  assert.equal(markPaidPlan(updated, paid, ["f1"]).newAmount, 0);
});
test("pagamento estornado reabre a cobrança; nota desconta recebimento parcial vinculado", () => {
  const updated = [{ ...fichas[0], paga: true }];
  const payments = [
    { id: "p1", valor: 60, alocacoes: [{ fid: "f1", centavos: 6000 }] },
    {
      id: "p2",
      valor: 40,
      estornado: true,
      alocacoes: [{ fid: "f1", centavos: 4000 }],
    },
  ];
  assert.equal(noteItems(updated, payments)[0].due, 4000);
});

import { weekRange, weeklySummary } from "../src/domain/index.ts";
test("semana local começa segunda e termina domingo, inclusive na virada do ano", () => {
  assert.deepEqual(weekRange(new Date(2026, 8, 27, 22)).days, [
    "2026-09-21",
    "2026-09-22",
    "2026-09-23",
    "2026-09-24",
    "2026-09-25",
    "2026-09-26",
    "2026-09-27",
  ]);
  assert.equal(weekRange(new Date(2026, 8, 28)).ini, "2026-09-28");
  assert.equal(weekRange(new Date(2027, 0, 1)).ini, "2026-12-28");
  assert.equal(weekRange(new Date(2027, 0, 1)).fim, "2027-01-03");
});
test("painel semanal exclui histórico, futuro, cancelamentos e estornos", () => {
  const row = (id, cid, data, valor, extra = {}) => ({
    id,
    cid,
    data,
    valor,
    qtd: 2,
    ...extra,
  });
  const report = weeklySummary(
    [
      row("mon", "c1", "2026-09-21", 10),
      row("sun", "c1", "2026-09-27", 15),
      row("old", "c1", "2026-09-20", 100),
      row("future", "c2", "2026-09-28", 100),
      row("cancel", "c3", "2026-09-23", 100, { cancelada: true }),
    ],
    [
      row("p1", "c1", "2026-09-21", 10),
      row("p2", "c2", "2026-09-27", 20),
      row("p3", "c1", "2026-09-20", 200),
      row("p4", "c3", "2026-09-22", 300, { estornado: true }),
      row("p5", "c3", "2026-09-28", 200),
    ],
    new Date(2026, 8, 27),
  );
  assert.equal(report.launched, 5000);
  assert.equal(report.received, 3000);
  assert.equal(report.pieces, 4);
  assert.equal(report.clients.size, 2);
  assert.equal(report.clients.get("c2").count, 0);
  assert.equal(report.days.length, 7);
  assert.equal(report.days[6].received, 2000);
});
