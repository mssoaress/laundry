import {
  changeAccount,
  createClient,
  newId,
  saveService,
} from "../data/repository";
import {
  cents,
  localDate,
  markPaidPlan,
  moneyInput,
  statement,
  validDate,
} from "../domain";
import { errorMessage, fmtC } from "../format";
import type {
  Account,
  Client,
  Database,
  Ficha,
  Mutation,
  Payment,
  Service,
} from "../types";
export const allocationsWithout = (
  payments: Payment[],
  id: string,
): Mutation[] =>
  payments
    .filter((p) => p.alocacoes?.some((a) => a.fid === id))
    .map((p) => ({
      col: "pagamentos",
      id: p.id,
      data: { alocacoes: p.alocacoes!.filter((a) => a.fid !== id) },
    }));
export function buildAccounts(db: Database): Map<string, Account> {
  const grouped = new Map(
    db.clientes.map((c) => [
      c.id,
      { fichas: [] as Ficha[], pagamentos: [] as Payment[] },
    ]),
  );
  for (const f of db.lancamentos) grouped.get(f.cid)?.fichas.push(f);
  for (const p of db.pagamentos) grouped.get(p.cid)?.pagamentos.push(p);
  return new Map(
    [...grouped].map(([id, data]) => [
      id,
      { ...data, ...statement(data.fichas, data.pagamentos) },
    ]),
  );
}
export function createOperations(
  getDb: () => Database,
  commandId: (key: string, signature: string) => string,
  notify: (message: string, error?: boolean) => void,
) {
  const account = (cid: string) =>
    buildAccounts(getDb()).get(cid) ?? {
      ...statement([], []),
      fichas: [],
      pagamentos: [],
    };
  return {
    async saveClient(nome: string, tel: string, original?: Client) {
      nome = nome.trim();
      tel = tel.trim();
      if (!nome) throw new Error("Informe o nome do cliente.");
      if (original)
        await changeAccount(original.id, ({ client }) => {
          if (
            client.nome !== original.nome ||
            (client.tel || "") !== (original.tel || "")
          )
            throw new Error(
              "Este cliente foi alterado em outro dispositivo. Reabra a edição para conferir.",
            );
          return [{ col: "clientes", id: original.id, data: { nome, tel } }];
        });
      else
        await createClient(
          { nome, tel },
          commandId("createClient", JSON.stringify({ nome, tel })),
        );
      notify(original ? "Cliente atualizado." : "Cliente cadastrado.");
    },
    async archiveClient(id: string) {
      const c = getDb().clientes.find((c) => c.id === id);
      if (!c) return;
      if (
        !confirm(
          `${c.arquivado ? "Restaurar" : "Arquivar"} ${c.nome}? O histórico financeiro será preservado.`,
        )
      )
        return;
      await changeAccount(id, () => [
        { col: "clientes", id, data: { arquivado: !c.arquivado } },
      ]);
    },
    async saveFicha(
      cid: string,
      data: Omit<Ficha, "id" | "cid">,
      original?: Ficha,
    ) {
      if (!cid) throw new Error("Selecione o cliente.");
      const id =
        original?.id ||
        commandId("createFicha", JSON.stringify({ cid, ...data }));
      await changeAccount(cid, ({ client, fichas, pagamentos }) => {
        if (original) {
          const f = fichas.find((f) => f.id === id);
          if (!f || f.cancelada) throw new Error("Esta ficha foi cancelada.");
          const signature = (f: Ficha) =>
            JSON.stringify([f.peca, f.data, f.qtd, f.valor, f.lavado]);
          if (signature(f) !== signature(original))
            throw new Error(
              "A ficha foi editada em outro dispositivo. Abra a edição novamente.",
            );
          if (
            statement(fichas, pagamentos).items.get(id)!.paid > 0 &&
            (data.qtd !== Number(f.qtd) || cents(data.valor) !== cents(f.valor))
          )
            throw new Error(
              "Desmarque a quitação antes de alterar quantidade ou valor. Os recebimentos serão preservados.",
            );
          return [{ col: "lancamentos", id, data }];
        }
        if (client.arquivado)
          throw new Error("Restaure o cliente antes de lançar fichas.");
        if (fichas.some((f) => f.id === id)) return [];
        return [
          {
            col: "lancamentos",
            id,
            data: {
              ...data,
              id,
              cid,
              paga: false,
              createdAtISO: new Date().toISOString(),
            },
          },
        ];
      });
      notify(original ? "Ficha atualizada." : "Ficha registrada.");
    },
    async cancelFicha(id: string) {
      const f = getDb().lancamentos.find((f) => f.id === id);
      if (
        !f ||
        !confirm(
          "Cancelar esta ficha? Ela sairá das cobranças. Os recebimentos serão preservados como saldo disponível e o histórico será mantido.",
        )
      )
        return;
      await changeAccount(f.cid, ({ pagamentos }) => [
        ...allocationsWithout(pagamentos, id),
        {
          col: "lancamentos",
          id,
          data: { cancelada: true, paga: false, canceladaEm: localDate() },
        },
      ]);
    },
    async restoreFicha(id: string) {
      const f = getDb().lancamentos.find((f) => f.id === id);
      if (!f || !confirm("Restaurar esta ficha como não paga?")) return;
      await changeAccount(f.cid, () => [
        { col: "lancamentos", id, data: { cancelada: false, paga: false } },
      ]);
    },
    async unmarkFicha(id: string) {
      const f = getDb().lancamentos.find((f) => f.id === id);
      if (
        !f ||
        !confirm(
          "Desmarcar esta ficha? Ela voltará à nota. Os pagamentos serão preservados e poderão ser vinculados novamente. Para desfazer uma entrada de dinheiro, use Estornar no pagamento.",
        )
      )
        return;
      await changeAccount(f.cid, ({ pagamentos }) => [
        ...allocationsWithout(pagamentos, id),
        { col: "lancamentos", id, data: { paga: false, pagaEm: null } },
      ]);
    },
    async registerPayment(cid: string, value: string, date: string) {
      const amount = moneyInput(value, { positive: true });
      if (!validDate(date)) throw new Error("Informe cliente e data válidos.");
      const expected = account(cid).due;
      if (
        amount > expected &&
        !confirm(
          `Este pagamento deixará ${fmtC(amount - expected)} de crédito. Confirmar?`,
        )
      )
        return false;
      const id = commandId(
        "registerPayment",
        JSON.stringify({ cid, amount, date }),
      );
      await changeAccount(cid, ({ fichas, pagamentos }) => {
        if (pagamentos.some((p) => p.id === id)) return [];
        if (statement(fichas, pagamentos).due !== expected)
          throw new Error(
            "O saldo mudou. Confira e confirme o pagamento novamente.",
          );
        return [
          {
            col: "pagamentos",
            id,
            data: {
              id,
              cid,
              valor: amount / 100,
              data: date,
              alocacoes: [],
              origem: "manual",
            },
          },
        ];
      });
      notify(
        "Pagamento registrado. Vincule-o às fichas usando Marcar como paga.",
      );
      return true;
    },
    async reversePayment(id: string) {
      const p = getDb().pagamentos.find((p) => p.id === id);
      if (!p || p.estornado) return;
      const motivo = prompt(
        `Estornar ${fmtC(cents(p.valor))}? Informe o motivo. As fichas vinculadas serão reabertas.`,
      );
      if (motivo === null) return;
      if (!motivo.trim()) throw new Error("Informe o motivo do estorno.");
      await changeAccount(p.cid, ({ pagamentos, fichas }) => {
        const payment = pagamentos.find((p) => p.id === id);
        if (!payment || payment.estornado) return [];
        return [
          {
            col: "pagamentos",
            id,
            data: {
              estornado: true,
              estornadoEm: localDate(),
              motivoEstorno: motivo.trim(),
            },
          },
          ...(payment.alocacoes || [])
            .filter((a) => fichas.some((f) => f.id === a.fid))
            .map(
              (a): Mutation => ({
                col: "lancamentos",
                id: a.fid,
                data: { paga: false },
              }),
            ),
        ];
      });
      notify("Pagamento estornado; histórico preservado.");
    },
    async markGroups(groups: { cid: string; ids: string[] }[]) {
      const plans = groups
        .map((g) => ({
          ...g,
          plan: markPaidPlan(
            account(g.cid).fichas,
            account(g.cid).pagamentos,
            g.ids,
          ),
        }))
        .filter((g) => g.plan.targets.length);
      if (!plans.length) {
        notify("As fichas selecionadas já estão pagas.");
        return;
      }
      let completed = 0;
      try {
        for (const group of plans) {
          const id = newId();
          await changeAccount(group.cid, ({ fichas, pagamentos }) => {
            const plan = markPaidPlan(fichas, pagamentos, group.ids);
            if (!plan.targets.length) return [];
            if (
              plan.newAmount !== group.plan.newAmount ||
              plan.reused !== group.plan.reused ||
              plan.targets.join() !== group.plan.targets.join()
            )
              throw new Error(
                "As fichas ou pagamentos mudaram. Confira os valores e tente novamente.",
              );
            const changes: Mutation[] = [
              ...plan.updates.map(
                (p): Mutation => ({
                  col: "pagamentos",
                  id: p.id,
                  data: { alocacoes: p.alocacoes },
                }),
              ),
              ...plan.targets.map(
                (fid): Mutation => ({
                  col: "lancamentos",
                  id: fid,
                  data: { paga: true, pagaEm: localDate() },
                }),
              ),
            ];
            if (plan.newAmount)
              changes.push({
                col: "pagamentos",
                id,
                data: {
                  id,
                  cid: group.cid,
                  valor: plan.newAmount / 100,
                  data: localDate(),
                  alocacoes: plan.allocations,
                  origem: "quitacao-ficha",
                },
              });
            return changes;
          });
          completed++;
        }
        notify("Fichas marcadas como pagas. Elas não entrarão nas notas.");
      } catch (error) {
        throw new Error(
          `${completed ? `${completed} cliente(s) já concluído(s). ` : ""}${errorMessage(error)}`,
        );
      }
    },
    async saveService(nome: string, value: string, original?: Service) {
      nome = nome.trim();
      const valor = moneyInput(value) / 100;
      if (!nome) throw new Error("Informe o nome.");
      if (
        !original &&
        getDb().lavados.some(
          (s) =>
            !s.arquivado &&
            s.nome.toLocaleLowerCase("pt-BR") ===
              nome.toLocaleLowerCase("pt-BR"),
        )
      )
        throw new Error("Lavado já cadastrado.");
      await saveService(
        { nome, valor, ...(!original ? { arquivado: false } : {}) },
        original?.id,
      );
      notify("Lavado salvo.");
    },
    async archiveService(id: string) {
      const s = getDb().lavados.find((s) => s.id === id);
      if (
        !s ||
        !confirm(
          `${s.arquivado ? "Restaurar" : "Arquivar"} o lavado ${s.nome}? As fichas existentes serão preservadas.`,
        )
      )
        return;
      await saveService(
        { nome: s.nome, valor: s.valor, arquivado: !s.arquivado },
        id,
      );
    },
  };
}
