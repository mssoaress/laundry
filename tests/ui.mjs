import assert from "node:assert/strict";
import { mkdir, readdir } from "node:fs/promises";
const production = process.env.TEST_BUILD === "1";
const noteModule = production
  ? `/assets/${(await readdir("dist/assets")).find((name) => /^note-.*\.js$/.test(name))}`
  : "/src/services/note.ts";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  timezoneId: "America/Fortaleza",
});
const errors = [];
const dialogs = [];
await mkdir("tests/artifacts", { recursive: true });
const fixture = `
const state={clientes:[{id:'c1',nome:'Cliente de teste',tel:'83999999999'},{id:'c2',nome:'Recebimento sem ficha'}],lancamentos:[{id:'f1',cid:'c1',peca:'Calças',qtd:10,valor:10,lavado:'Amaciado',lavadoId:'s1',data:'2026-09-01'},{id:'f2',cid:'c1',peca:'Blusas',qtd:20,valor:10,lavado:'Amaciado',lavadoId:'s1',data:'2026-09-02'}],pagamentos:[{id:'p1',cid:'c1',valor:150,data:'2026-09-01'},{id:'p2',cid:'c2',valor:50,data:'2025-08-01'}],lavados:[{id:'s1',nome:'Amaciado',valor:10}]};
const handlers={};let queue=Promise.resolve();window.__state=state;
const emit=()=>Object.keys(handlers).forEach(col=>handlers[col](structuredClone(state[col]),{fromCache:false}));
window.__emit=emit;
export const newId=()=>crypto.randomUUID();
export function subscribe(col,next,error){handlers[col]=next;queueMicrotask(()=>next(structuredClone(state[col]),{fromCache:false}));return ()=>delete handlers[col];}
export async function createClient(data,id=newId()){if(!state.clientes.some(c=>c.id===id)){state.clientes.push({...data,id});emit();}if(window.__failAfterCommit){window.__failAfterCommit=false;throw new Error("Resposta interrompida após gravar");}}
export async function changeAccount(cid,operation){const task=queue.then(async()=>{await new Promise(r=>setTimeout(r,30));const mutations=operation({client:structuredClone(state.clientes.find(c=>c.id===cid)),fichas:structuredClone(state.lancamentos.filter(f=>f.cid===cid)),pagamentos:structuredClone(state.pagamentos.filter(p=>p.cid===cid))});for(const m of mutations||[]){let row=state[m.col].find(r=>r.id===m.id);if(row)Object.assign(row,m.data);else state[m.col].push({id:m.id,...m.data});}if(mutations?.length)emit();if(window.__failAfterCommit){window.__failAfterCommit=false;throw new Error('Resposta interrompida após gravar');}});queue=task.catch(()=>{});return task;}
export async function saveService(data,id=newId()){const old=state.lavados.find(s=>s.id===id);if(old)Object.assign(old,data);else state.lavados.push({...data,id});emit();}
`;
await context.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  if (url.hostname !== "127.0.0.1") {
    await route.abort();
    return;
  }
  if (
    url.pathname === "/src/data/repository.ts" ||
    /^\/assets\/repository-.*\.js$/.test(url.pathname)
  ) {
    await route.fulfill({
      contentType: "application/javascript",
      body: fixture,
    });
    return;
  }
  await route.continue();
});
await context.addInitScript(() => localStorage.setItem("le_auth_ok", "1"));
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (dialog) => {
  dialogs.push(dialog.message());
  return dialog.accept(
    dialog.type() === "prompt"
      ? dialog.message().startsWith("Novo valor")
        ? "12.50"
        : "Teste de estorno"
      : undefined,
  );
});
async function clickMenu(selector) {
  const item = page.locator(selector);
  await item.locator("xpath=ancestor::details[1]/summary").click();
  await item.click();
}
await page.clock.setFixedTime(new Date("2026-09-27T12:00:00-03:00"));
try {
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5503");
  await page.locator("#loading-overlay").waitFor({ state: "hidden" });
  assert.match(
    await page.locator("#dash-date").innerText(),
    /21\/09\/2026.*27\/09\/2026/,
  );
  assert.equal(
    await page
      .locator("#metrics-cards .val")
      .allTextContents()
      .then((v) => v.map((x) => x.replace(/\s/g, "")))
      .then((v) => JSON.stringify(v)),
    JSON.stringify(["R$0,00", "R$0,00", "0", "0"]),
  );
  assert.match(
    await page.locator("#tbl-aberto").innerText(),
    /Nenhuma movimentação/,
  );
  await page.locator('.sidebar [data-page="clientes"]').click();
  await page
    .locator('#client-list [data-action="detail"][data-id="c1"]')
    .first()
    .click();
  assert.equal(
    await page
      .locator('#detalhe-fichas-abertas [data-action="payFicha"]')
      .count(),
    2,
  );
  await page
    .locator('#detalhe-fichas-abertas [data-action="payFicha"][data-id="f1"]')
    .click();
  await page.waitForFunction(
    () => window.__state.lancamentos.find((f) => f.id === "f1").paga === true,
  );
  assert.equal(
    await page.evaluate(() =>
      window.__state.pagamentos.reduce((s, p) => s + p.valor, 0),
    ),
    200,
  );
  await page.waitForFunction(
    () =>
      document.querySelectorAll(
        '#detalhe-fichas-abertas [data-action="payFicha"]',
      ).length === 1,
  );
  await page.locator('[data-action="selectNote"]').click();
  assert.equal(await page.locator(".chk-nota").count(), 1);
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "Gerar nota", exact: true }).click(),
  ]);
  await popup.waitForFunction(() =>
    document.body.textContent.includes("Total a pagar"),
  );
  assert.match(await popup.locator("tbody").innerText(), /Blusas/);
  assert.doesNotMatch(await popup.locator("tbody").innerText(), /Calças/);
  assert.equal(await popup.locator(".whatsapp-icon").count(), 2);
  assert.match(
    await popup.locator(".verse").innerText(),
    /Até aqui nos ajudou o Senhor/,
  );
  await popup.waitForFunction(() =>
    [...document.images].every((img) => img.complete && img.naturalWidth > 0),
  );
  await popup.pdf({
    path: "tests/artifacts/nota-uma-ficha.pdf",
    preferCSSPageSize: true,
    printBackground: true,
  });
  await popup.evaluate(() => {
    window.__printed = 0;
    window.print = () => window.__printed++;
  });
  await popup.locator("#print-note").click();
  await popup.waitForFunction(() => window.__printed === 1);
  assert.match(page.url(), /^http:\/\/127/);
  await popup.close();
  await page
    .locator('#detalhe-fichas-abertas [data-action="payFicha"][data-id="f2"]')
    .click();
  await page.waitForFunction(
    () => window.__state.lancamentos.find((f) => f.id === "f2").paga === true,
  );
  assert.equal(
    await page.evaluate(() =>
      window.__state.pagamentos.reduce((s, p) => s + p.valor, 0),
    ),
    350,
  );
  await page.waitForFunction(
    () =>
      document.querySelectorAll(
        '#detalhe-fichas-abertas [data-action="payFicha"]',
      ).length === 0,
  );
  await page.screenshot({
    path: "tests/artifacts/desktop-paid.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.equal(
    dialogs.length,
    0,
    "Marcar como paga não deve abrir confirmação, mesmo registrando novo recebimento.",
  );
  // Desmarcar libera o vínculo, mantendo receita.
  await page.locator('[data-detail-tab="history"]').click();
  await clickMenu(
    '#detalhe-todas-fichas [data-action="unmarkFicha"][data-id="f2"]',
  );
  await page.waitForFunction(
    () => window.__state.lancamentos.find((f) => f.id === "f2").paga === false,
  );
  assert.equal(
    await page.evaluate(() =>
      window.__state.pagamentos.reduce((s, p) => s + p.valor, 0),
    ),
    350,
  );
  // Relatório inclui cliente apenas com recebimento e o ano sem fichas.
  await page.locator('.sidebar [data-page="relatorio"]').click();
  await page.locator("#r-ano").selectOption("2025");
  await page.locator("#r-mes").selectOption("08");
  assert.match(
    await page.locator("#tbl-relatorio").innerText(),
    /Recebimento sem ficha/,
  );
  // Cadastro: preço padrão preenchido e quantidade inválida rejeitada.
  await page.locator('.sidebar [data-page="lancamentos"]').click();
  await page.getByRole("button", { name: "Nova ficha", exact: true }).click();
  await page.locator("#l-cliente").selectOption("c1");
  await page.locator("#l-lavado").selectOption("s1");
  assert.equal(await page.locator("#l-valor").inputValue(), "10.00");
  await page.locator("#l-peca").fill("Teste");
  await page.locator("#l-qtd").fill("-2");
  await page.getByRole("button", { name: "Salvar ficha", exact: true }).click();
  await page.waitForFunction(() =>
    document
      .querySelector("#app-message")
      .textContent.includes("inteiro maior"),
  );
  assert.equal(await page.evaluate(() => window.__state.lancamentos.length), 2);
  await page.locator("#l-qtd").fill("3");
  await page.getByRole("button", { name: "Salvar ficha", exact: true }).click();
  await page.waitForFunction(() => window.__state.lancamentos.length === 3);
  // Mobile e navegação de todas as páginas.
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of [
    "dashboard",
    "clientes",
    "lancamentos",
    "pendentes",
    "relatorio",
    "lavados",
  ]) {
    await page.locator(`.bottom-nav [data-page="${id}"]`).click();
    assert.equal(await page.locator(`#${id}`).isVisible(), true);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `overflow em ${id}`,
    );
  }
  await page.locator('.bottom-nav [data-page="clientes"]').click();
  await page
    .locator('#client-list [data-action="detail"][data-id="c1"]')
    .first()
    .click();
  await page.screenshot({
    path: "tests/artifacts/mobile-client.png",
    fullPage: true,
    animations: "disabled",
  });
  // Resposta perdida após gravar: repetir a confirmação não duplica a receita.
  await page.locator('#detalhe-header [data-action="payment"]').click();
  await page.locator("#m-valor").fill("10");
  await page.evaluate(() => (window.__failAfterCommit = true));
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await page.waitForFunction(() =>
    document
      .querySelector("#app-message")
      .textContent.includes("Resposta interrompida"),
  );
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await page.locator("#modal-bg").waitFor({ state: "hidden" });
  assert.equal(
    await page.evaluate(() =>
      window.__state.pagamentos
        .filter((p) => p.cid === "c1")
        .reduce((s, p) => s + p.valor, 0),
    ),
    310,
  );
  // Edição, cancelamento e restauração da ficha recém-criada.
  await page.locator('[data-detail-tab="history"]').click();
  const newFicha = await page.evaluate(
    () =>
      window.__state.lancamentos.find((f) => !["f1", "f2"].includes(f.id)).id,
  );
  await clickMenu(
    `#detalhe-todas-fichas [data-action="editFicha"][data-id="${newFicha}"]`,
  );
  await page.locator("#e-qtd").fill("4");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.locator("#modal-edit-bg").waitFor({ state: "hidden" });
  await page.waitForFunction(
    (id) => window.__state.lancamentos.find((f) => f.id === id).qtd === 4,
    newFicha,
  );
  await clickMenu(
    `#detalhe-todas-fichas [data-action="deleteFicha"][data-id="${newFicha}"]`,
  );
  await page.waitForFunction(
    (id) =>
      window.__state.lancamentos.find((f) => f.id === id).cancelada === true,
    newFicha,
  );
  await page.locator("#cancelled-fichas summary").click();
  await page
    .locator(`[data-action="restoreFicha"][data-id="${newFicha}"]`)
    .click();
  await page.waitForFunction(
    (id) =>
      window.__state.lancamentos.find((f) => f.id === id).cancelada === false,
    newFicha,
  );
  // Estorno de pagamento vinculado reabre a ficha e mantém o registro.
  await page.locator('[data-detail-tab="payments"]').click();
  await page.locator('[data-action="reverse"][data-id="p1"]').click();
  await page.waitForFunction(
    () =>
      window.__state.pagamentos.find((p) => p.id === "p1").estornado === true,
  );
  assert.equal(
    await page.evaluate(
      () => window.__state.lancamentos.find((f) => f.id === "f1").paga,
    ),
    false,
  );
  // Seleções sobrevivem ao realtime. Quitação no relatório não inclui outro mês.
  await page.evaluate(() => {
    window.__state.lancamentos.push({
      id: "fora-periodo",
      cid: "c1",
      peca: "Fora do período",
      qtd: 1,
      valor: 400,
      lavado: "Amaciado",
      data: "2026-05-01",
    });
    window.__emit();
  });
  await page.locator('.bottom-nav [data-page="relatorio"]').click();
  await page.locator("#r-ano").selectOption("2026");
  await page.locator("#r-mes").selectOption("09");
  await page.locator('.chk-rel[data-cid="c1"]').check();
  await page.evaluate(() => window.__emit());
  await page.waitForFunction(
    () => document.querySelector('.chk-rel[data-cid="c1"]').checked,
  );
  await page
    .getByRole("button", { name: "Quitar fichas do período", exact: true })
    .click();
  await page.waitForFunction(
    () => window.__state.lancamentos.find((f) => f.id === "f2").paga === true,
  );
  assert.notEqual(
    await page.evaluate(
      () =>
        window.__state.lancamentos.find((f) => f.id === "fora-periodo").paga,
    ),
    true,
  );
  // O arquivamento preserva pagamentos e fichas.
  await page.locator('.bottom-nav [data-page="clientes"]').click();
  const paymentCount = await page.evaluate(
    () => window.__state.pagamentos.length,
  );
  await clickMenu('#client-list [data-action="archiveClient"][data-id="c1"]');
  await page.waitForFunction(
    () => window.__state.clientes.find((c) => c.id === "c1").arquivado === true,
  );
  assert.equal(
    await page.evaluate(() => window.__state.pagamentos.length),
    paymentCount,
  );
  await page.locator("#show-archived").check();
  await clickMenu('#client-list [data-action="archiveClient"][data-id="c1"]');
  await page.waitForFunction(
    () =>
      window.__state.clientes.find((c) => c.id === "c1").arquivado === false,
  );
  // Edição integrada, filtros, busca e consulta de todo o histórico.
  const editClient = page.locator(
    '#client-list [data-action="editClient"][data-id="c1"]',
  );
  await editClient.locator("xpath=ancestor::details[1]/summary").click();
  await page.evaluate(() => {
    window.__state.clientes.find((c) => c.id === "c1").tel = "83988887777";
    window.__emit();
  });
  await page.waitForFunction(() =>
    document.querySelector("#client-list").textContent.includes("83988887777"),
  );
  assert.equal(
    await editClient.isVisible(),
    true,
    "A sincronização deve preservar o menu aberto",
  );
  await editClient.click();
  await page.locator("#edit-client-name").fill("Cliente atualizado");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await page.locator("#client-edit-bg").waitFor({ state: "hidden" });
  await page.waitForFunction(
    () =>
      window.__state.clientes.find((c) => c.id === "c1").nome ===
      "Cliente atualizado",
  );
  await page.locator('[data-client-filter="pending"]').click();
  assert.equal(await page.locator("#client-list .client-card").count(), 1);
  await page.locator('[data-client-filter="settled"]').click();
  assert.match(
    await page.locator("#client-list").innerText(),
    /Recebimento sem ficha/,
  );
  await page.locator('[data-client-filter="all"]').click();
  await page.locator("#client-search").fill("atualizado");
  assert.equal(await page.locator("#client-list .client-card").count(), 1);
  await page.locator("#client-search").fill("");
  await page.locator('.bottom-nav [data-page="relatorio"]').click();
  await page.locator('[data-periodo="todos"]').click();
  const totalRecebido = await page.evaluate(() =>
    window.__state.pagamentos
      .filter((p) => !p.estornado)
      .reduce((s, p) => s + Math.round(p.valor * 100), 0),
  );
  assert.equal(
    (await page.locator("#r-metrics .val").first().innerText()).replace(
      /\s/g,
      "",
    ),
    (totalRecebido / 100)
      .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      .replace(/\s/g, ""),
  );
  assert.match(
    await page.locator("#tbl-relatorio").innerText(),
    /Recebimento sem ficha/,
  );
  // Cadastro de cliente com resposta perdida, edição preservada em tempo real e catálogo.
  await page.locator('.bottom-nav [data-page="clientes"]').click();
  await page.getByRole("button", { name: "Novo cliente", exact: true }).click();
  await page.locator("#c-nome").fill("Cliente novo");
  await page.locator("#c-tel").fill("83922223333");
  await page.evaluate(() => (window.__failAfterCommit = true));
  await page
    .getByRole("button", { name: "Salvar cliente", exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector("#app-message")
      .textContent.includes("Resposta interrompida"),
  );
  await page
    .getByRole("button", { name: "Salvar cliente", exact: true })
    .click();
  await page.locator("#form-cliente").waitFor({ state: "hidden" });
  assert.equal(
    await page.evaluate(
      () =>
        window.__state.clientes.filter((c) => c.nome === "Cliente novo").length,
    ),
    1,
  );
  await clickMenu('#client-list [data-action="editClient"][data-id="c1"]');
  await page.locator("#edit-client-name").fill("Edição ainda não salva");
  await page.evaluate(() => window.__emit());
  assert.equal(
    await page.locator("#edit-client-name").inputValue(),
    "Edição ainda não salva",
  );
  await page.keyboard.press("Escape");
  await page.locator("#client-edit-bg").waitFor({ state: "hidden" });
  assert.equal(
    await page.evaluate(
      () => window.__state.clientes.find((c) => c.id === "c1").nome,
    ),
    "Cliente atualizado",
  );
  await page.locator('.bottom-nav [data-page="lavados"]').click();
  await page.getByRole("button", { name: "Novo lavado", exact: true }).click();
  await page.locator("#lv-nome").fill("Lavado novo");
  await page.locator("#lv-valor").fill("4.25");
  await page
    .getByRole("button", { name: "Salvar lavado", exact: true })
    .click();
  await page.locator("#form-lavado").waitFor({ state: "hidden" });
  const serviceId = await page.evaluate(
    () => window.__state.lavados.find((s) => s.nome === "Lavado novo").id,
  );
  await page
    .locator(`[data-action="archiveService"][data-id="${serviceId}"]`)
    .click();
  await page.waitForFunction(
    (id) => window.__state.lavados.find((s) => s.id === id).arquivado === true,
    serviceId,
  );
  await page
    .locator(`[data-action="archiveService"][data-id="${serviceId}"]`)
    .click();
  await page.waitForFunction(
    (id) => window.__state.lavados.find((s) => s.id === id).arquivado === false,
    serviceId,
  );
  await page.locator('[data-action="editService"][data-id="s1"]').click();
  await page.waitForFunction(
    () => window.__state.lavados.find((s) => s.id === "s1").valor === 12.5,
  );
  assert.equal(
    await page.evaluate(
      () => window.__state.lancamentos.find((f) => f.id === "f1").valor,
    ),
    10,
  );
  // Dados demonstrativos somente na memória do teste para revisão visual de todas as telas.
  await page.evaluate(() => {
    const names = [
      "Marina Confecções",
      "Bruno Almeida",
      "Ateliê da Clara",
      "Renato Costa",
      "Sofia & Cia",
      "Pedro Martins",
    ];
    window.__state.clientes = names.map((nome, i) => ({
      id: "demo" + i,
      nome,
      tel: i === 2 ? "" : "(83) 9 9999-000" + i,
    }));
    window.__state.lancamentos = [];
    window.__state.pagamentos = [];
    names.forEach((nome, i) => {
      const cid = "demo" + i,
        qtd = 40 + i * 9,
        valor = 3.5;
      const a = {
        id: cid + "a",
        cid,
        peca: [
          "Calças jeans",
          "Shorts",
          "Camisas",
          "Vestidos",
          "Jaquetas",
          "Bermudas",
        ][i],
        qtd,
        valor,
        lavado: "Amaciado",
        lavadoId: "s1",
        data: "2026-09-" + (21 + i),
      };
      const b = {
        id: cid + "b",
        cid,
        peca: "Blusas",
        qtd: 32,
        valor: 3.3,
        lavado: "Amaciado",
        lavadoId: "s1",
        data: "2026-09-10",
      };
      const paid = i === 2 || i === 5;
      a.paga = paid;
      b.paga = paid;
      window.__state.lancamentos.push(a, b);
      window.__state.pagamentos.push({
        id: cid + "p",
        cid,
        data: "2026-09-" + (21 + i),
        valor: paid ? (qtd * 350 + 10560) / 100 : 40 + i * 15,
        alocacoes: paid
          ? [
              { fid: a.id, centavos: qtd * 350 },
              { fid: b.id, centavos: 10560 },
            ]
          : [],
      });
    });
    window.__state.lancamentos.push({
      id: "future",
      cid: "demo0",
      peca: "Ficha futura",
      qtd: 200,
      valor: 10,
      lavado: "Amaciado",
      data: "2026-10-24",
    });
    window.__emit();
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.sidebar [data-page="dashboard"]').click();
  assert.doesNotMatch(
    await page.locator("#tbl-ultimos").innerText(),
    /Ficha futura/,
  );
  assert.equal(
    (await page.locator("#metrics-cards .val").nth(2).innerText()).trim(),
    "375",
  );
  if (await page.locator("#dismiss-message").isVisible())
    await page.locator("#dismiss-message").click();
  await page.screenshot({
    path: "tests/artifacts/redesign-dashboard.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.locator('.sidebar [data-page="clientes"]').click();
  await page.screenshot({
    path: "tests/artifacts/redesign-clientes.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .locator('#client-list [data-action="detail"][data-id="demo0"]')
    .first()
    .click();
  await page.screenshot({
    path: "tests/artifacts/redesign-cliente-detalhe.png",
    fullPage: true,
    animations: "disabled",
  });
  for (const id of ["lancamentos", "pendentes", "relatorio", "lavados"]) {
    await page.locator(`.sidebar [data-page="${id}"]`).click();
    await page.screenshot({
      path: `tests/artifacts/redesign-${id}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    const navigation = width < 768 ? ".bottom-nav" : ".sidebar";
    for (const id of [
      "dashboard",
      "clientes",
      "lancamentos",
      "pendentes",
      "relatorio",
      "lavados",
    ]) {
      await page.locator(`${navigation} [data-page="${id}"]`).click();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `overflow na tela ${id} em ${width}px`,
      );
    }
    await page.locator(`${navigation} [data-page="clientes"]`).click();
    if (width === 390)
      await page.screenshot({
        path: "tests/artifacts/redesign-mobile-clientes.png",
        fullPage: true,
        animations: "disabled",
      });
    await page
      .locator('#client-list [data-action="detail"][data-id="demo0"]')
      .first()
      .click();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `overflow no detalhe em ${width}px`,
    );
    for (const tab of ["paid", "payments", "history", "open"])
      await page.locator(`[data-detail-tab="${tab}"]`).click();
    if (width === 390)
      await page.screenshot({
        path: "tests/artifacts/redesign-mobile-detalhe.png",
        fullPage: true,
        animations: "disabled",
      });
  }
  assert.deepEqual(errors, []);
  // Conferência da impressão com nomes longos, pagamento parcial e várias páginas.
  const noteHtml = await page.evaluate(async (modulePath) => {
    const { renderNote } = await import(modulePath);
    const items = Array.from({ length: 6 }, (_, i) => ({
      peca:
        i === 0 ? "Calças & conjuntos <especial>" : `Blusas modelo ${i + 1}`,
      lavado: i === 0 ? "Marmorizado" : "Amaciado",
      qtd: 50,
      valor: 3.5,
      data: "2026-09-21",
      total: 17500,
      paid: i === 0 ? 5000 : 0,
      due: i === 0 ? 12500 : 17500,
    }));
    window.__noteItems = items;
    return renderNote({
      client: { nome: "Marina Confecções & Ateliê" },
      items,
      logo: new URL("/img/logo-nova-lavanderia.png", location.href).href,
      date: "2026-09-27",
    });
  }, noteModule);
  const printed = await context.newPage();
  await printed.setContent(noteHtml);
  await printed.waitForFunction(() =>
    [...document.images].every((img) => img.complete && img.naturalWidth > 0),
  );
  assert.equal(await printed.locator("tbody tr").count(), 6);
  assert.match(
    await printed.locator("tbody").innerText(),
    /Calças & conjuntos <especial>/,
  );
  assert.match(await printed.locator(".total").innerText(), /1\.000,00/);
  await printed.pdf({
    path: "tests/artifacts/nota-modelo.pdf",
    preferCSSPageSize: true,
    printBackground: true,
  });
  const longHtml = await page.evaluate(async (modulePath) => {
    const { renderNote } = await import(modulePath);
    const items = Array.from({ length: 60 }, (_, i) => ({
      ...window.__noteItems[i % 6],
      peca: `Ficha ${i + 1} - Conjunto de peças com descrição extensa para conferir a impressão`,
    }));
    return renderNote({
      client: {
        nome: "Cliente com nome extenso para conferir a disposição e a quebra de linha na nota de serviços",
      },
      items,
      logo: new URL("/img/logo-nova-lavanderia.png", location.href).href,
      date: "2026-09-27",
    });
  }, noteModule);
  await printed.setContent(longHtml);
  await printed.waitForFunction(() =>
    [...document.images].every((img) => img.complete && img.naturalWidth > 0),
  );
  await printed.pdf({
    path: "tests/artifacts/nota-multiplas-paginas.pdf",
    preferCSSPageSize: true,
    printBackground: true,
  });
  await printed.close();
  console.log(
    "UI: quitação, pagamentos antigos, diferença, nota, desmarcação, relatório, validação, cadastro, edição, cancelamento, estorno, arquivamento, seleção realtime, quitação por período, recuperação de falhas e navegação móvel aprovados.",
  );
} finally {
  await browser.close();
}
