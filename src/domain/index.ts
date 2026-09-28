import type {
  Ficha,
  Payment,
  FichaInput,
  FichaItem,
  Allocation,
} from "../types";
// Regras financeiras independentes da interface e do Firebase. Valores internos em centavos.
export function cents(value: number | string) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error("Valor monetário inválido.");
  const result = Math.round(
    (number + Math.sign(number) * Number.EPSILON) * 100,
  );
  if (!Number.isSafeInteger(result))
    throw new Error("Valor monetário fora do limite.");
  return result;
}
export function moneyInput(value: number | string, { positive = false } = {}) {
  const text = String(value).trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(text))
    throw new Error("Informe um valor válido, com até duas casas decimais.");
  const result = cents(text);
  if (positive && result <= 0)
    throw new Error("O valor deve ser maior que zero.");
  return result;
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && localDate(date) === value;
}
export function validateFicha({ peca, data, qtd, valor, lavado }: FichaInput) {
  if (!String(peca || "").trim()) throw new Error("Informe a peça.");
  if (!validDate(data)) throw new Error("Informe uma data válida.");
  if (!Number.isSafeInteger(Number(qtd)) || Number(qtd) <= 0)
    throw new Error("A quantidade deve ser um número inteiro maior que zero.");
  if (!lavado) throw new Error("Selecione um lavado.");
  const unit = moneyInput(valor);
  if (!Number.isSafeInteger(unit * Number(qtd)))
    throw new Error("Total fora do limite.");
  return {
    peca: peca.trim(),
    data,
    qtd: Number(qtd),
    valor: unit / 100,
    lavado,
  };
}
export function fichaCents(ficha: Ficha) {
  return cents(ficha.valor) * Number(ficha.qtd);
}
export function paymentCents(payment: Payment) {
  return payment.estornado ? 0 : cents(payment.valor);
}
export function byDate(
  a: { data: string; id: string },
  b: { data: string; id: string },
) {
  return (
    String(a.data).localeCompare(String(b.data)) ||
    String(a.id).localeCompare(String(b.id))
  );
}
export function statement(fichas: Ficha[], pagamentos: Payment[]) {
  const ordered = [...fichas].filter((f) => !f.cancelada).sort(byDate);
  const items = new Map<string, FichaItem>(
    ordered.map((f) => [
      f.id,
      {
        ...f,
        total: fichaCents(f),
        paid: 0,
        due: fichaCents(f),
        settled: false,
        status: "Não paga",
      },
    ]),
  );
  let available = 0,
    received = 0;
  for (const payment of pagamentos.filter((p) => !p.estornado).sort(byDate)) {
    let amount = paymentCents(payment);
    received += amount;
    for (const allocation of payment.alocacoes || []) {
      const item = items.get(allocation.fid);
      if (!item) continue;
      const used = Math.min(
        amount,
        Math.max(0, Number(allocation.centavos) || 0),
        item.due,
      );
      item.paid += used;
      item.due -= used;
      amount -= used;
    }
    available += amount;
  }
  for (const item of items.values()) {
    item.settled = item.paga === true && item.due === 0;
    item.status =
      item.total === 0
        ? "Sem cobrança"
        : item.settled
          ? "Paga"
          : item.paid > 0
            ? "Parcial"
            : "Não paga";
  }
  const total = [...items.values()].reduce((s, f) => s + f.total, 0);
  return {
    items,
    total,
    received,
    due: Math.max(0, total - received),
    credit: Math.max(0, received - total),
    available,
  };
}
// A migração é manual: dinheiro antigo só é vinculado quando o usuário marca a ficha.
export function markPaidPlan(
  fichas: Ficha[],
  pagamentos: Payment[],
  ids: string[],
) {
  const account = statement(fichas, pagamentos);
  const targets = [...account.items.values()].filter(
    (f) => ids.includes(f.id) && !f.settled,
  );
  const updates = new Map<string, Payment>();
  const usable = pagamentos
    .filter((p) => !p.estornado)
    .sort(byDate)
    .map((p) => ({
      ...p,
      alocacoes: (p.alocacoes || []).map((a) => ({ ...a })),
      free: Math.max(
        0,
        paymentCents(p) -
          (p.alocacoes || []).reduce((s, a) => s + a.centavos, 0),
      ),
    }));
  let newAmount = 0,
    reused = 0;
  const allocations: Allocation[] = [];
  for (const item of targets) {
    let due = item.due;
    for (const payment of usable) {
      const used = Math.min(due, payment.free);
      if (!used) continue;
      payment.alocacoes.push({ fid: item.id, centavos: used });
      payment.free -= used;
      due -= used;
      reused += used;
      updates.set(payment.id, {
        ...payment,
        alocacoes: payment.alocacoes,
      });
    }
    if (due > 0) {
      allocations.push({ fid: item.id, centavos: due });
      newAmount += due;
    }
  }
  return {
    targets: targets.map((f) => f.id),
    updates: [...updates.values()],
    newAmount,
    reused,
    allocations,
  };
}
export function noteItems(
  fichas: Ficha[],
  pagamentos: Payment[],
  ids: string[] | null = null,
) {
  return [...statement(fichas, pagamentos).items.values()].filter(
    (f) => !f.settled && f.due > 0 && (!ids || ids.includes(f.id)),
  );
}

// Semana civil local: segunda a domingo, inclusive, sem conversão para UTC.
export function weekRange(date = new Date()) {
  const monday = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
  );
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(day.getDate() + index);
    return localDate(day);
  });
  return { ini: days[0], fim: days[6], days };
}
export function weeklySummary(
  fichas: Ficha[],
  pagamentos: Payment[],
  date = new Date(),
) {
  const range = weekRange(date);
  const within = (item: { data: string }) =>
    item.data >= range.ini && item.data <= range.fim;
  const entries = fichas.filter((f) => !f.cancelada && within(f));
  const payments = pagamentos.filter((p) => !p.estornado && within(p));
  const clients = new Map<
    string,
    {
      cid: string;
      count: number;
      pieces: number;
      launched: number;
      received: number;
    }
  >();
  const days = new Map(
    range.days.map((data) => [data, { data, launched: 0, received: 0 }]),
  );
  const row = (cid: string) => {
    if (!clients.has(cid))
      clients.set(cid, { cid, count: 0, pieces: 0, launched: 0, received: 0 });
    return clients.get(cid)!;
  };
  for (const f of entries) {
    const value = fichaCents(f),
      client = row(f.cid);
    client.count++;
    client.pieces += Number(f.qtd);
    client.launched += value;
    days.get(f.data)!.launched += value;
  }
  for (const p of payments) {
    const value = paymentCents(p);
    row(p.cid).received += value;
    days.get(p.data)!.received += value;
  }
  return {
    range,
    entries,
    payments,
    clients,
    days: [...days.values()],
    launched: entries.reduce((s, f) => s + fichaCents(f), 0),
    received: payments.reduce((s, p) => s + paymentCents(p), 0),
    pieces: entries.reduce((s, f) => s + Number(f.qtd), 0),
  };
}
