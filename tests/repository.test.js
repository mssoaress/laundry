import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { markPaidPlan } from "../src/domain/index.ts";
// Exercita o adaptador real com o protocolo transacional substituído em memória.
const source = stripTypeScriptTypes(
  readFileSync(new URL("../src/data/repository.ts", import.meta.url), "utf8"),
)
  .replace(/import[\s\S]*?from\s+["'][^"']+["'];/g, "")
  .replace(/export /g, "");
function harness() {
  const state = {
    clientes: [{ id: "c", revision: 0 }],
    lancamentos: [
      { id: "f", cid: "c", qtd: 1, valor: 100, data: "2026-09-01" },
    ],
    pagamentos: [],
  };
  let chain = Promise.resolve(),
    conflicts = 0;
  const snapshot = (row) => ({
    exists: () => !!row,
    data: () => structuredClone(row),
  });
  const api = {
    initializeApp: () => ({}),
    getFirestore: () => ({}),
    collection: (_, col) => ({ col }),
    doc: (_, col, id) => ({ col, id }),
    serverTimestamp: () => 0,
    where: (field, op, val) => ({ field, val }),
    query: (ref, filter) => ({ ...ref, filter }),
    getDocFromServer: async (ref) =>
      snapshot(state[ref.col].find((r) => r.id === ref.id)),
    getDocsFromServer: async (ref) => ({
      docs: structuredClone(
        state[ref.col].filter((r) => r[ref.filter.field] === ref.filter.val),
      ).map((r) => ({ id: r.id, data: () => r })),
    }),
    runTransaction: async (_, operation) => {
      const task = chain.then(async () => {
        const pending = [];
        const tx = {
          get: async (ref) =>
            snapshot(state[ref.col].find((r) => r.id === ref.id)),
          set: (ref, data) => pending.push({ ref, data }),
        };
        try {
          await operation(tx);
        } catch (e) {
          if (e.message === "ACCOUNT_CHANGED") conflicts++;
          throw e;
        }
        for (const { ref, data } of pending) {
          const old = state[ref.col].find((r) => r.id === ref.id);
          if (old) Object.assign(old, data);
          else state[ref.col].push({ id: ref.id, ...data });
        }
      });
      chain = task.catch(() => {});
      return task;
    },
    setDoc: async () => {},
    onSnapshot: () => {},
    crypto: globalThis.crypto,
  };
  return {
    state,
    get conflicts() {
      return conflicts;
    },
    ...new Function(...Object.keys(api), source + ";return {changeAccount};")(
      ...Object.values(api),
    ),
  };
}
test("duas quitações concorrentes registram um único recebimento", async () => {
  const h = harness();
  const settle = ({ fichas, pagamentos }) => {
    const plan = markPaidPlan(fichas, pagamentos, ["f"]);
    if (!plan.targets.length) return [];
    return [
      { col: "lancamentos", id: "f", data: { paga: true } },
      ...plan.updates.map((p) => ({ col: "pagamentos", id: p.id, data: p })),
      {
        col: "pagamentos",
        id: crypto.randomUUID(),
        data: {
          cid: "c",
          valor: plan.newAmount / 100,
          alocacoes: plan.allocations,
        },
      },
    ];
  };
  await Promise.all([
    h.changeAccount("c", settle),
    h.changeAccount("c", settle),
  ]);
  assert.equal(h.state.pagamentos.length, 1);
  assert.equal(h.state.pagamentos[0].valor, 100);
  assert.equal(h.state.clientes[0].revision, 1);
  assert.equal(h.conflicts, 1);
});
test("erro na operação não aplica gravações parciais", async () => {
  const h = harness();
  await assert.rejects(
    h.changeAccount("c", () => {
      throw new Error("Saldo mudou");
    }),
    /Saldo mudou/,
  );
  assert.equal(h.state.clientes[0].revision, 0);
  assert.equal(h.state.pagamentos.length, 0);
});
