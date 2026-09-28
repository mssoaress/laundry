/* ===== ACESSO PROTEGIDO ===== */
// A senha nao fica em texto puro: guardamos apenas o hash SHA-256 dela.
const AUTH_HASH =
  "2cddab7030321d19487e561e20e52c3b80e09f0b98c7361e6b1a3dc3e5a8a241";
const AUTH_KEY = "le_auth_ok";

async function sha256(texto) {
  const buf = new TextEncoder().encode(texto);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function mostrarTelaSenha() {
  return new Promise((resolve) => {
    document.getElementById("loading-overlay").style.display = "none";
    const overlay = document.createElement("div");
    overlay.className = "loading-overlay";
    overlay.id = "auth-overlay";
    overlay.innerHTML = `
      <div class="loading-inner" style="width:min(280px,88vw)">
        <img src="img/logo-nova-lavanderia.png" alt="Logo" class="loading-logo-img">
        <div class="form-group" style="width:100%">
          <label style="color:rgba(255,255,255,.85)">Senha de acesso</label>
          <input type="password" id="auth-senha" inputmode="numeric" autocomplete="off"
            style="text-align:center;font-size:1.1rem;letter-spacing:.3em">
        </div>
        <div id="auth-erro" style="color:#ffb4b4;font-size:.8rem;font-weight:600;min-height:1em"></div>
        <button class="btn-primary" id="auth-btn" style="width:100%">Entrar</button>
      </div>`;
    document.body.appendChild(overlay);

    const input = overlay.querySelector("#auth-senha");
    const erro = overlay.querySelector("#auth-erro");
    const btn = overlay.querySelector("#auth-btn");
    input.focus();

    async function tentar() {
      const valor = input.value.trim();
      if (!valor) return;
      const hash = await sha256(valor);
      if (hash === AUTH_HASH) {
        localStorage.setItem(AUTH_KEY, "1");
        overlay.remove();
        resolve();
      } else {
        erro.textContent = "Senha incorreta";
        input.value = "";
        input.focus();
      }
    }
    btn.addEventListener("click", tentar);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") tentar();
    });
  });
}

async function garantirAcesso() {
  if (localStorage.getItem(AUTH_KEY) === "1") return;
  await mostrarTelaSenha();
}

import {
  cents,
  moneyInput,
  localDate,
  validDate,
  validateFicha,
  fichaCents,
  paymentCents,
  byDate,
  statement,
  markPaidPlan,
  noteItems,
  weeklySummary,
} from "./domain.js";
import { renderNote } from "./note.js";
import {
  subscribe,
  createClient,
  changeAccount,
  saveService,
  newId,
} from "./repository.js";

const $ = (id) => document.getElementById(id);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmtC = (n) =>
  (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtN = (n) => Number(n).toLocaleString("pt-BR");
const formatDate = (value) =>
  validDate(value) ? value.split("-").reverse().join("/") : "Data inválida";
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const db = { clientes: [], lancamentos: [], pagamentos: [], lavados: [] };
let paginaAtual = "dashboard",
  clienteDetalheId = null,
  modalCid = null,
  editFichaId = null,
  periodoAtual = "mensal";
let ready = false,
  unsubscribers = [],
  refreshTimer = null,
  accountCache = null,
  showArchived = false;
let editingClient = null;
let clientFilter = "all",
  detailTab = "open",
  noticeTimer;
const limits = new Map(),
  selectedReport = new Set(),
  selectedPending = new Set(),
  selectedNotes = new Set();
const PAGE_SIZE = 40;
const busy = new Set();
const commandIds = new Map();
function commandId(key, signature) {
  const saved = commandIds.get(key);
  if (!saved || saved.signature !== signature)
    commandIds.set(key, { id: newId(), signature });
  return commandIds.get(key).id;
}
function notify(message, error = false) {
  clearTimeout(noticeTimer);
  const el = $("app-message");
  el.textContent = message;
  el.hidden = false;
  el.classList.toggle("error", error);
  if (!error)
    noticeTimer = setTimeout(() => {
      el.hidden = true;
    }, 6000);
}
function hideLoading() {
  $("loading-overlay").style.display = "none";
}
function showLoading(message) {
  $("loading-overlay").style.display = "flex";
  $("loading-msg").textContent = message;
}
function activeClients() {
  return db.clientes.filter((c) => !c.arquivado);
}
function clientName(id) {
  return db.clientes.find((c) => c.id === id)?.nome || "Cliente indisponível";
}
function initials(nome) {
  return String(nome || "")
    .split(" ")
    .filter(Boolean)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
function accounts() {
  if (accountCache) return accountCache;
  const grouped = new Map(
    db.clientes.map((c) => [c.id, { fichas: [], pagamentos: [] }]),
  );
  for (const f of db.lancamentos) grouped.get(f.cid)?.fichas.push(f);
  for (const p of db.pagamentos) grouped.get(p.cid)?.pagamentos.push(p);
  accountCache = new Map(
    [...grouped].map(([cid, data]) => [
      cid,
      { ...data, ...statement(data.fichas, data.pagamentos) },
    ]),
  );
  return accountCache;
}
function account(cid) {
  return accounts().get(cid) || statement([], []);
}
function icon(name) {
  const paths = {
    check: '<path d="m5 12 4 4L19 6"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    wallet:
      '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18m-6 5h3"/>',
    sheets:
      '<rect x="6" y="3" width="14" height="18" rx="2"/><path d="M3 7v12m7-11h6m-6 4h6m-6 4h4"/>',
    users:
      '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m3 9v-2a5 5 0 0 0-3-4"/>',
    box: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8M12 13v9"/>',
    phone: '<path d="m7 3-3 2c-2 5 10 17 15 15l2-3-5-3-2 2-6-6 2-2-3-5Z"/>',
    print:
      '<path d="M7 8V3h10v5M7 17H3V9h18v8h-4"/><path d="M7 14h10v7H7zM17 11h1"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
    calendar:
      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>',
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.sheets}</svg>`;
}
function moneyMarkup(value) {
  return `<span class="currency-prefix">R$</span> <span class="currency-number">${esc(String(value).replace(/^R\$\s*/, ""))}</span>`;
}
function metric(label, value, featured = false, tone = "", hint = "") {
  const glyph = /receb|crédito|saldo/i.test(label)
    ? "wallet"
    : /cliente/i.test(label)
      ? "users"
      : /peça/i.test(label)
        ? "box"
        : "sheets";
  return `<div class="metric ${featured ? "featured" : ""}"><div class="metric-top"><div class="lbl">${esc(label)}</div><span class="metric-icon">${icon(glyph)}</span></div><div class="val ${tone}">${String(value).startsWith("R$") ? moneyMarkup(value) : esc(value)}</div>${hint ? `<div class="metric-hint">${esc(hint)}</div>` : ""}</div>`;
}
function actionMenu(label, content) {
  return `<details class="action-menu"><summary aria-label="${esc(label)}" title="${esc(label)}">${icon("more")}</summary><div class="action-menu-content">${content}</div></details>`;
}
function action(label, name, id = "", className = "btn-quitar") {
  return `<button type="button" class="${className}" data-action="${esc(name)}" data-id="${esc(id)}">${esc(label)}</button>`;
}
function empty(text) {
  return `<div class="empty-state"><div class="empty-state-title">${esc(text)}</div></div>`;
}
function clientCell(c) {
  return `<div class="client-row"><div class="avatar">${esc(initials(c.nome))}</div>${esc(c.nome)}${c.arquivado ? " (arquivado)" : ""}</div>`;
}
function limited(items, key) {
  return items.slice(0, limits.get(key) || PAGE_SIZE);
}
function more(items, key) {
  return items.length > (limits.get(key) || PAGE_SIZE)
    ? action(
        `Mostrar mais (${items.length} registros)`,
        "more",
        key,
        "btn-ghost",
      )
    : "";
}
function badge(item) {
  return `<span class="badge ${item.settled ? "badge-green" : item.paid > 0 ? "badge-amber" : "badge-red"}">${esc(item.status)}</span>`;
}
async function execute(key, fn) {
  if (busy.has(key)) return;
  busy.add(key);
  document.body.classList.add("saving");
  $("save-status").textContent = "Salvando…";
  try {
    await fn();
    commandIds.delete(key);
  } catch (error) {
    console.error(error);
    notify(
      error.message === "ACCOUNT_CHANGED"
        ? "Os dados mudaram em outro dispositivo. Confira e tente novamente."
        : `Não foi possível concluir: ${error.message || "verifique a conexão."}`,
      true,
    );
  } finally {
    busy.delete(key);
    if (!busy.size) {
      document.body.classList.remove("saving");
      $("save-status").textContent = "";
    }
  }
}
function refresh() {
  accountCache = null;
  if (!ready) return;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    try {
      populateSelects();
      renderPage();
    } catch (error) {
      notify(
        `Há dados inválidos que precisam de revisão: ${error.message}`,
        true,
      );
    }
  }, 40);
}
function startListeners() {
  unsubscribers.forEach((fn) => fn());
  unsubscribers = [];
  const loaded = new Set(),
    cache = new Map();
  showLoading("Conectando…");
  const timeout = setTimeout(() => {
    hideLoading();
    notify(
      "A conexão está demorando. Verifique a internet e use Reconectar.",
      true,
    );
  }, 12000);
  for (const col of Object.keys(db))
    unsubscribers.push(
      subscribe(
        col,
        (rows, metadata) => {
          db[col] = rows;
          loaded.add(col);
          cache.set(col, metadata.fromCache);
          accountCache = null;
          $("connection-status").textContent = [...cache.values()].some(Boolean)
            ? "Dados em cache · aguardando sincronização"
            : "Sincronizado";
          if (loaded.size === 4) {
            clearTimeout(timeout);
            hideLoading();
            if (!ready) {
              ready = true;
              initialize();
            } else refresh();
          }
        },
        (error) => {
          clearTimeout(timeout);
          hideLoading();
          notify(
            `Falha ao carregar ${col}: ${error.message}. Use Reconectar.`,
            true,
          );
        },
      ),
    );
}
function initialize() {
  $("r-mes").value = String(new Date().getMonth() + 1).padStart(2, "0");
  $("l-data").value = localDate();
  const monday = new Date();
  monday.setDate(
    monday.getDate() + (monday.getDay() === 0 ? -6 : 1 - monday.getDay()),
  );
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  $("r-semana-inicio").value = localDate(monday);
  $("r-semana-fim").value = localDate(sunday);
  populateSelects();
  renderPage();
}
function showPage(id) {
  paginaAtual = id;
  $("current-page-label").textContent =
    {
      dashboard: "Visão da semana",
      clientes: "Clientes",
      lancamentos: "Fichas",
      pendentes: "Pendências",
      relatorio: "Relatórios",
      lavados: "Serviços",
      "cliente-detalhe": "Detalhe do cliente",
    }[id] || id;
  document.querySelector(".main").scrollTop = 0;
  window.scrollTo({ top: 0, behavior: "instant" });
  document
    .querySelectorAll(".page")
    .forEach((el) => el.classList.toggle("active", el.id === id));
  document.querySelectorAll("[data-page]").forEach((el) => {
    el.classList.toggle("active", el.dataset.page === id);
    el.setAttribute("aria-current", el.dataset.page === id ? "page" : "false");
  });
  renderPage();
}
function renderPage() {
  if (!ready) return;
  const openMenus = new Set(
    [...document.querySelectorAll(".page.active details[open]")]
      .map((menu) => menu.querySelector("[data-action]"))
      .filter(Boolean)
      .map((button) =>
        JSON.stringify([button.dataset.action, button.dataset.id]),
      ),
  );
  ({
    dashboard: renderDashboard,
    clientes: renderClientes,
    lancamentos: renderLancamentos,
    relatorio: renderRelatorio,
    pendentes: renderPendentes,
    lavados: renderLavados,
    "cliente-detalhe": () => renderDetalheCliente(clienteDetalheId),
  })[paginaAtual]?.();
  document.querySelectorAll(".page.active details").forEach((menu) => {
    const button = menu.querySelector("[data-action]");
    if (
      button &&
      openMenus.has(JSON.stringify([button.dataset.action, button.dataset.id]))
    ) {
      menu.open = true;
    }
  });
}
function fillSelect(id, items, placeholder = null) {
  const el = $(id),
    old = el.value;
  const html =
    (placeholder === null
      ? ""
      : `<option value="">${esc(placeholder)}</option>`) +
    items
      .map((i) => `<option value="${esc(i.value)}">${esc(i.label)}</option>`)
      .join("");
  if (el.innerHTML !== html) {
    el.innerHTML = html;
    if ([...el.options].some((o) => o.value === old)) el.value = old;
  }
}
function populateSelects() {
  const clients = [...activeClients()]
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map((c) => ({ value: c.id, label: c.nome }));
  fillSelect("l-cliente", clients, "Selecione…");
  fillSelect(
    "f-cliente",
    db.clientes.map((c) => ({
      value: c.id,
      label: c.nome + (c.arquivado ? " (arquivado)" : ""),
    })),
    "Todos os clientes",
  );
  const services = db.lavados
    .filter((l) => !l.arquivado)
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map((l) => ({ value: l.id, label: l.nome }));
  fillSelect("l-lavado", services, "Selecione…");
  const editing = db.lancamentos.find((f) => f.id === editFichaId);
  const historical =
    editing &&
    (db.lavados.find((s) => s.id === editing.lavadoId) ||
      db.lavados.find((s) => s.nome === editing.lavado));
  const editServices =
    historical && !services.some((s) => s.value === historical.id)
      ? [
          ...services,
          { value: historical.id, label: historical.nome + " (arquivado)" },
        ]
      : services;
  fillSelect("e-lavado", editServices, "Selecione…");
  const years = [
    ...new Set(
      [
        String(new Date().getFullYear()),
        ...db.lancamentos.map((f) => f.data?.slice(0, 4)),
        ...db.pagamentos.map((p) => p.data?.slice(0, 4)),
      ].filter((y) => /^\d{4}$/.test(y)),
    ),
  ]
    .sort()
    .reverse()
    .map((y) => ({ value: y, label: y }));
  const prev = $("r-ano").value;
  fillSelect("r-ano", years);
  if (!prev) $("r-ano").value = String(new Date().getFullYear());
  fillSelect("f-ano", years, "Todos os anos");
}
function toggleForm(id, cid) {
  const el = $(id);
  const open = el.style.display !== "block";
  el.style.display = open ? "block" : "none";
  if (open) {
    populateSelects();
    if (cid) $("l-cliente").value = cid;
    if (id === "form-lanc") {
      $("l-data").value = localDate();
      applyServicePrice("l");
    }
    el.querySelector("input,select")?.focus();
  }
}
function renderDashboard() {
  const week = weeklySummary(db.lancamentos, db.pagamentos);
  $("dash-date").textContent =
    `De ${formatDate(week.range.ini)} a ${formatDate(week.range.fim)} · segunda a domingo`;
  $("metrics-cards").innerHTML =
    metric(
      "Recebido na semana",
      fmtC(week.received),
      true,
      "",
      "Pagamentos registrados no período",
    ) +
    metric(
      "Lançado na semana",
      fmtC(week.launched),
      false,
      "",
      `${week.entries.length} fichas registradas`,
    ) +
    metric(
      "Peças na semana",
      fmtN(week.pieces),
      false,
      "",
      "Volume de serviços lançados",
    ) +
    metric(
      "Clientes na semana",
      fmtN(week.clients.size),
      false,
      "",
      "Com fichas ou pagamentos no período",
    );
  const clients = [...week.clients.values()].sort(
    (a, b) => b.launched - a.launched || b.received - a.received,
  );
  $("tbl-aberto").innerHTML =
    limited(clients, "dashboard")
      .map((row) => {
        const c = db.clientes.find((c) => c.id === row.cid) || {
          id: row.cid,
          nome: "Cliente indisponível",
        };
        return `<tr><td><button class="table-client" data-action="detail" data-id="${esc(c.id)}">${clientCell(c)}</button></td><td>${row.count}</td><td class="number-cell">${fmtC(row.launched)}</td><td class="number-cell text-success">${fmtC(row.received)}</td></tr>`;
      })
      .join("") ||
    '<tr><td colspan="4" class="empty-cell">Nenhuma movimentação nesta semana.</td></tr>';
  $("dash-more").innerHTML = more(clients, "dashboard");
  $("tbl-ultimos").innerHTML =
    [...week.entries]
      .sort((a, b) => byDate(b, a))
      .slice(0, 6)
      .map(
        (f) =>
          `<tr><td>${formatDate(f.data)}</td><td>${esc(clientName(f.cid))}</td><td>${esc(f.peca)}</td><td>${fmtN(f.qtd)}</td><td class="number-cell">${fmtC(fichaCents(f))}</td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="5" class="empty-cell">Nenhuma ficha nesta semana.</td></tr>';
  const maximum = Math.max(
    1,
    ...week.days.flatMap((day) => [day.launched, day.received]),
  );
  const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  $("weekly-chart").innerHTML = week.days
    .map(
      (day, i) =>
        `<div class="chart-day ${day.data === localDate() ? "is-today" : ""}"><div class="chart-bars"><div class="chart-bar launched" style="height:${(day.launched / maximum) * 100}%" title="${formatDate(day.data)} · Lançado: ${fmtC(day.launched)}"></div><div class="chart-bar received" style="height:${(day.received / maximum) * 100}%" title="${formatDate(day.data)} · Recebido: ${fmtC(day.received)}"></div></div><span>${weekdays[i]}</span><small>${day.data.slice(8)}</small></div>`,
    )
    .join("");
  $("weekly-chart-accessible").textContent = week.days
    .map(
      (day, i) =>
        `${weekdays[i]}: lançado ${fmtC(day.launched)}, recebido ${fmtC(day.received)}`,
    )
    .join(". ");
  $("weekly-chart-scale").textContent =
    `${fmtC(maximum === 1 ? 0 : maximum)} / dia`;
  $("weekly-highlight").innerHTML =
    `<span class="eyebrow">Sua semana em foco</span><h3>${week.entries.length ? `${fmtN(week.pieces)} peças nesta semana` : "Uma nova semana.<br>Tudo organizado."}</h3><p>Fichas, clientes e recebimentos em um só lugar.</p><button class="btn-primary" onclick="showPage('lancamentos');toggleForm('form-lanc')">${icon("sheets")} Nova ficha</button>`;
}

function renderClientes() {
  const search = $("client-search").value.trim().toLocaleLowerCase("pt-BR");
  const active = activeClients();
  $("client-summary").innerHTML =
    metric(
      "Clientes ativos",
      fmtN(active.length),
      false,
      "",
      "Na sua carteira de clientes",
    ) +
    metric(
      "Total a receber",
      fmtC(active.reduce((s, c) => s + account(c.id).due, 0)),
      false,
      "",
      "Saldo dos clientes ativos",
    ) +
    metric(
      "Clientes em dia",
      fmtN(active.filter((c) => account(c.id).due === 0).length),
      false,
      "success",
      "Sem pendência financeira",
    );
  const clients = db.clientes.filter(
    (c) =>
      (showArchived || !c.arquivado) &&
      `${c.nome} ${c.tel || ""}`.toLocaleLowerCase("pt-BR").includes(search) &&
      (clientFilter === "all" ||
        (clientFilter === "pending"
          ? account(c.id).due > 0
          : account(c.id).due === 0)),
  );
  const order = $("client-sort").value;
  clients.sort((a, b) =>
    order === "balance"
      ? account(b.id).due - account(a.id).due || a.nome.localeCompare(b.nome)
      : a.nome.localeCompare(b.nome),
  );
  $("client-result-count").textContent =
    `${clients.length} cliente${clients.length === 1 ? "" : "s"}`;
  $("client-list").innerHTML =
    limited(clients, "clientes")
      .map((c) => {
        const a = account(c.id),
          entries = [...a.items.values()],
          last = entries.sort((a, b) => byDate(b, a))[0];
        const tone = c.arquivado ? "neutral" : a.due > 0 ? "amber" : "green";
        return `<article class="client-card"><div class="client-card-top"><button class="client-identity" data-action="detail" data-id="${esc(c.id)}"><span class="avatar">${esc(initials(c.nome))}</span><span><span class="client-card-name">${esc(c.nome)}</span><span class="client-card-phone">${esc(c.tel || "Sem telefone cadastrado")}</span></span></button>${actionMenu(`Ações de ${c.nome}`, action("Editar cliente", "editClient", c.id, "menu-item") + action(c.arquivado ? "Restaurar cliente" : "Arquivar cliente", "archiveClient", c.id, "menu-item danger"))}</div><div class="client-status-line"><span class="badge badge-${tone}">${c.arquivado ? "Arquivado" : a.due > 0 ? "Saldo pendente" : "Em dia"}</span><span>${entries.length} fichas</span></div><div class="client-financials"><div><span>A receber</span><strong>${fmtC(a.due)}</strong></div><div><span>Recebido</span><strong>${fmtC(a.received)}</strong></div><div><span>${a.credit ? "Crédito" : "Lançado"}</span><strong>${fmtC(a.credit || a.total)}</strong></div></div><div class="client-card-footer"><span>${last ? `Última ficha · ${formatDate(last.data)}` : "Pronto para a primeira ficha"}</span><button class="client-open" data-action="detail" data-id="${esc(c.id)}">Ver cliente ${icon("arrow")}</button></div></article>`;
      })
      .join("") ||
    empty("Nenhum cliente encontrado. Tente outro nome ou filtro.");
  $("clients-more").innerHTML = more(clients, "clientes");
}
async function salvarCliente() {
  const nome = $("c-nome").value.trim(),
    tel = $("c-tel").value.trim();
  if (!nome) throw new Error("Digite o nome do cliente.");
  await createClient(
    { nome, tel },
    commandId("salvarCliente", JSON.stringify({ nome, tel })),
  );
  $("c-nome").value = "";
  $("c-tel").value = "";
  toggleForm("form-cliente");
  notify("Cliente cadastrado.");
}
function editarCliente(id) {
  const client = db.clientes.find((c) => c.id === id);
  if (!client) return;
  editingClient = { ...client };
  $("edit-client-name").value = client.nome;
  $("edit-client-phone").value = client.tel || "";
  openModal("client-edit-bg");
}
function closeClientEditor() {
  closeDialog("client-edit-bg");
  editingClient = null;
}
async function saveClientEditor() {
  const original = editingClient;
  if (!original) return;
  const nome = $("edit-client-name").value.trim(),
    tel = $("edit-client-phone").value.trim();
  if (!nome) throw new Error("Informe o nome do cliente.");
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
  closeClientEditor();
  notify("Cliente atualizado.");
}
async function deletarCliente(id) {
  const c = db.clientes.find((c) => c.id === id);
  if (
    !confirm(
      `${c.arquivado ? "Restaurar" : "Arquivar"} ${c.nome}? O histórico financeiro será preservado.`,
    )
  )
    return;
  await changeAccount(id, ({ client }) => [
    { col: "clientes", id, data: { arquivado: !client.arquivado } },
  ]);
}
function filteredFichas() {
  let list = db.lancamentos.filter((f) => !f.cancelada);
  const cid = $("f-cliente").value,
    month = $("f-mes").value,
    year = $("f-ano").value;
  if (cid) list = list.filter((f) => f.cid === cid);
  if (month) list = list.filter((f) => f.data?.slice(5, 7) === month);
  if (year) list = list.filter((f) => f.data?.slice(0, 4) === year);
  return list.sort((a, b) => byDate(b, a));
}
function fichaCard(f, detail = false) {
  const item = account(f.cid).items.get(f.id);
  if (!item) return "";
  const menu =
    (item.settled
      ? action("Desmarcar paga", "unmarkFicha", f.id, "menu-item")
      : "") +
    (item.paid > 0 && !item.settled
      ? action("Desvincular pagamento", "unmarkFicha", f.id, "menu-item")
      : "") +
    action("Editar ficha", "editFicha", f.id, "menu-item") +
    action("Cancelar ficha", "deleteFicha", f.id, "menu-item danger");
  return `<article class="lanc-card ${item.settled ? "is-paid" : ""}"><div class="ficha-symbol">${icon(item.settled ? "check" : "sheets")}</div><div class="lanc-card-left"><div class="ficha-heading"><h3 class="lanc-card-peca">${esc(f.peca)}</h3>${badge(item)}</div><div class="lanc-card-meta">${detail ? "" : `${esc(clientName(f.cid))} · `}${fmtN(f.qtd)} peças <span>·</span> ${esc(f.lavado)} <span>·</span> ${formatDate(f.data)}</div>${item.paid > 0 && !item.settled ? `<div class="partial-info">Já vinculado ${fmtC(item.paid)} · Restante ${fmtC(item.due)}</div>` : ""}</div><div class="lanc-card-right"><strong class="lanc-card-total">${fmtC(item.total)}</strong><div class="lanc-card-btns">${item.settled ? `<span class="paid-label">${icon("check")} Paga</span>` : `<button class="btn-quitar" data-action="payFicha" data-id="${esc(f.id)}">${icon("check")} Marcar como paga</button>`}${actionMenu(`Ações da ficha ${f.peca}`, menu)}</div></div></article>`;
}

function renderLancamentos() {
  const list = filteredFichas();
  $("lanc-list").innerHTML =
    limited(list, "fichas")
      .map((f) => fichaCard(f))
      .join("") || empty("Nenhuma ficha encontrada");
  $("fichas-more").innerHTML =
    `<p class="list-total">${fmtN(list.reduce((s, f) => s + Number(f.qtd), 0))} peças · ${fmtC(list.reduce((s, f) => s + fichaCents(f), 0))}</p>` +
    more(list, "fichas");
}
function applyServicePrice(prefix) {
  const service = db.lavados.find((s) => s.id === $(`${prefix}-lavado`).value);
  if (service)
    $(`${prefix}-valor`).value = (cents(service.valor) / 100).toFixed(2);
  updatePreview(prefix);
}
function updatePreview(prefix = "l") {
  try {
    const qty = Number($(`${prefix}-qtd`).value),
      value = moneyInput($(`${prefix}-valor`).value);
    $(`${prefix}-preview`).textContent =
      Number.isSafeInteger(qty) && qty > 0 ? `Total: ${fmtC(qty * value)}` : "";
  } catch {
    $(`${prefix}-preview`).textContent = "";
  }
}
function formFicha(prefix) {
  const service = db.lavados.find((s) => s.id === $(`${prefix}-lavado`).value);
  if (!service) throw new Error("Selecione um lavado disponível.");
  return {
    ...validateFicha({
      peca: $(`${prefix}-peca`).value,
      data: $(`${prefix}-data`).value,
      qtd: $(`${prefix}-qtd`).value,
      valor: $(`${prefix}-valor`).value,
      lavado: service.nome,
    }),
    lavadoId: service.id,
  };
}
async function salvarLancamento() {
  const cid = $("l-cliente").value;
  if (!cid) throw new Error("Selecione o cliente.");
  const data = formFicha("l"),
    id = commandId("salvarLancamento", JSON.stringify({ cid, ...data }));
  await changeAccount(cid, ({ client, fichas }) => {
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
  $("l-peca").value = "";
  $("l-qtd").value = "";
  $("l-preview").textContent = "";
  toggleForm("form-lanc");
  notify("Ficha registrada.");
}
function allocationsWithout(payments, id) {
  return payments
    .filter((p) => (p.alocacoes || []).some((a) => a.fid === id))
    .map((p) => ({
      col: "pagamentos",
      id: p.id,
      data: { alocacoes: p.alocacoes.filter((a) => a.fid !== id) },
    }));
}
async function deletarLanc(id) {
  const f = db.lancamentos.find((f) => f.id === id);
  if (!f) return;
  if (
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
}
function editarFicha(id) {
  const f = db.lancamentos.find((f) => f.id === id);
  if (!f) return;
  editFichaId = id;
  populateSelects();
  for (const name of ["peca", "data", "qtd", "valor"])
    $(`e-${name}`).value = f[name];
  let service =
    db.lavados.find((s) => s.id === f.lavadoId) ||
    db.lavados.find((s) => s.nome === f.lavado);
  if (
    service &&
    ![...$("e-lavado").options].some((o) => o.value === service.id)
  )
    $("e-lavado").add(new Option(service.nome, service.id));
  $("e-lavado").value = service?.id || "";
  updatePreview("e");
  openModal("modal-edit-bg");
}
function closeEditModal() {
  closeDialog("modal-edit-bg");
  editFichaId = null;
}
async function salvarEdicaoFicha() {
  const id = editFichaId,
    orig = db.lancamentos.find((f) => f.id === id);
  if (!orig) throw new Error("Ficha não encontrada.");
  const data = formFicha("e");
  await changeAccount(orig.cid, ({ fichas, pagamentos }) => {
    const f = fichas.find((f) => f.id === id);
    if (!f || f.cancelada) throw new Error("Esta ficha foi cancelada.");
    if (
      JSON.stringify([f.peca, f.data, f.qtd, f.valor, f.lavado]) !==
      JSON.stringify([orig.peca, orig.data, orig.qtd, orig.valor, orig.lavado])
    )
      throw new Error(
        "A ficha foi editada em outro dispositivo. Abra a edição novamente.",
      );
    const a = statement(fichas, pagamentos).items.get(id);
    if (
      a.paid > 0 &&
      (data.qtd !== Number(f.qtd) || cents(data.valor) !== cents(f.valor))
    )
      throw new Error(
        "Desmarque a quitação antes de alterar quantidade ou valor. Os recebimentos serão preservados.",
      );
    return [{ col: "lancamentos", id, data }];
  });
  closeEditModal();
  notify("Ficha atualizada.");
}
function reportRange() {
  if (periodoAtual === "todos") return { ini: "0000-01-01", fim: "9999-12-31" };
  if (periodoAtual === "mensal") {
    const ym = `${$("r-ano").value}-${$("r-mes").value}`;
    return { ini: `${ym}-01`, fim: `${ym}-31` };
  }
  const ini = $("r-semana-inicio").value,
    fim = $("r-semana-fim").value;
  if (!validDate(ini) || !validDate(fim) || ini > fim) return null;
  return { ini, fim };
}
function inRange(row, range) {
  return range && row.data >= range.ini && row.data <= range.fim;
}
function setPeriodo(p) {
  periodoAtual = p;
  selectedReport.clear();
  document
    .querySelectorAll(".filtro-tab")
    .forEach((el) => el.classList.toggle("active", el.dataset.periodo === p));
  $("controles-mensal").style.display = p === "mensal" ? "flex" : "none";
  $("controles-semanal").style.display = p === "semanal" ? "flex" : "none";
  renderRelatorio();
}
function renderRelatorio() {
  const range = reportRange();
  if (!range) {
    $("r-metrics").innerHTML = empty("Selecione um período válido.");
    $("r-barras").innerHTML = "";
    $("tbl-relatorio").innerHTML = "";
    selectedReport.clear();
    updateBulkActions();
    return;
  }
  const fichas = db.lancamentos.filter(
      (f) => !f.cancelada && inRange(f, range),
    ),
    payments = db.pagamentos.filter((p) => !p.estornado && inRange(p, range));
  const grouped = new Map();
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
  $("r-metrics").innerHTML =
    metric(
      "Recebido no período",
      fmtC(payments.reduce((s, p) => s + paymentCents(p), 0)),
      true,
    ) +
    metric(
      "Lançado no período",
      fmtC(fichas.reduce((s, f) => s + fichaCents(f), 0)),
    ) +
    metric(
      "Peças lavadas",
      fmtN(fichas.reduce((s, f) => s + Number(f.qtd), 0)),
    );
  const clients = db.clientes
    .filter((c) => grouped.has(c.id))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  for (const id of selectedReport)
    if (!grouped.has(id)) selectedReport.delete(id);
  const max = Math.max(1, ...[...grouped.values()].map((g) => g.pcs));
  $("r-barras").innerHTML =
    limited(clients, "relatorio")
      .filter((c) => grouped.get(c.id).pcs)
      .map((c) => {
        const pcs = grouped.get(c.id).pcs;
        return `<div class="bar-row"><div class="bar-label" title="${esc(c.nome)}">${esc(c.nome)}</div><div class="bar-wrap"><div class="bar-fill" style="width:${Math.round((pcs / max) * 100)}%"></div></div><div class="bar-value">${fmtN(pcs)}</div></div>`;
      })
      .join("") || empty("Sem peças no período");
  $("tbl-relatorio").innerHTML =
    limited(clients, "relatorio")
      .map((c) => {
        const row = grouped.get(c.id);
        return `<tr><td><input aria-label="Selecionar ${esc(c.nome)}" type="checkbox" class="chk-rel" data-cid="${esc(c.id)}" ${selectedReport.has(c.id) ? "checked" : ""}></td><td>${clientCell(c)}</td><td>${fmtN(row.pcs)}</td><td>${fmtC(row.total)}</td><td>${fmtC(row.received)}</td><td>${fmtC(account(c.id).due)}</td><td>${action("Pagamento", "payment", c.id)}</td></tr>`;
      })
      .join("") ||
    '<tr><td colspan="7">Nenhum movimento neste período</td></tr>';
  $("report-more").innerHTML = more(clients, "relatorio");
  updateBulkActions();
}
function updateBulkActions() {
  $("bulk-actions").style.display = selectedReport.size ? "flex" : "none";
  $("bulk-label").textContent =
    `${selectedReport.size} cliente(s) · fichas do período`;
  syncAll("chk-all", ".chk-rel");
}
function syncAll(id, selector) {
  const items = [...document.querySelectorAll(selector)],
    checked = items.filter((c) => c.checked).length;
  $(id).checked = items.length > 0 && checked === items.length;
  $(id).indeterminate = checked > 0 && checked < items.length;
}
function toggleSelectionAll(selector, set, checked) {
  document.querySelectorAll(selector).forEach((el) => {
    el.checked = checked;
    if (checked) set.add(el.dataset.cid);
    else set.delete(el.dataset.cid);
  });
}
function toggleAllChk() {
  toggleSelectionAll(".chk-rel", selectedReport, $("chk-all").checked);
  updateBulkActions();
}
function desmarcarTodos() {
  selectedReport.clear();
  document.querySelectorAll(".chk-rel").forEach((c) => (c.checked = false));
  updateBulkActions();
}
async function marcarSelecionadosPago() {
  const range = reportRange();
  if (!range) throw new Error("Selecione um período válido.");
  const groups = [...selectedReport].map((cid) => ({
    cid,
    ids: db.lancamentos
      .filter((f) => f.cid === cid && !f.cancelada && inRange(f, range))
      .map((f) => f.id),
  }));
  await markGroups(groups, "Quitar somente as fichas do período selecionado");
  desmarcarTodos();
}
function renderPendentes() {
  const all = [...accounts().values()];
  const clients = db.clientes
    .filter((c) => account(c.id).due > 0)
    .sort((a, b) => account(b.id).due - account(a.id).due);
  const due = all.reduce((s, a) => s + a.due, 0);
  for (const id of selectedPending)
    if (!clients.some((c) => c.id === id)) selectedPending.delete(id);
  $("pendentes-total").textContent =
    `${clients.length} pendente(s) · ${fmtC(due)}`;
  $("pendentes-metrics").innerHTML =
    metric("Pendentes", clients.length) +
    metric("Saldo em aberto", fmtC(due), true) +
    metric("Total lançado", fmtC(all.reduce((s, a) => s + a.total, 0))) +
    metric("Total recebido", fmtC(all.reduce((s, a) => s + a.received, 0)));
  $("tbl-pendentes").innerHTML =
    limited(clients, "pendentes")
      .map((c) => {
        const a = account(c.id);
        const last = [...a.items.values()].sort((a, b) => byDate(b, a))[0];
        return `<tr><td><input type="checkbox" class="chk-pend" data-cid="${esc(c.id)}" aria-label="Selecionar ${esc(c.nome)}" ${selectedPending.has(c.id) ? "checked" : ""}></td><td>${clientCell(c)}</td><td>${fmtC(a.due)}</td><td>${last ? formatDate(last.data) : "—"}</td><td>${action("Quitar", "settle", c.id)}</td></tr>`;
      })
      .join("") || '<tr><td colspan="5">Nenhuma pendência financeira</td></tr>';
  $("pending-more").innerHTML = more(clients, "pendentes");
  updatePendBulk();
}
function updatePendBulk() {
  $("pend-bulk-actions").style.display = selectedPending.size ? "flex" : "none";
  $("pend-bulk-label").textContent =
    `${selectedPending.size} cliente(s) · ${fmtC([...selectedPending].reduce((s, id) => s + account(id).due, 0))}`;
  syncAll("chk-pend-all", ".chk-pend");
}
function toggleAllPendChk() {
  toggleSelectionAll(".chk-pend", selectedPending, $("chk-pend-all").checked);
  updatePendBulk();
}
function desmarcarPendentes() {
  selectedPending.clear();
  document.querySelectorAll(".chk-pend").forEach((c) => (c.checked = false));
  updatePendBulk();
}
async function marcarPendentesPago() {
  await markGroups(
    [...selectedPending].map((cid) => ({
      cid,
      ids: [...account(cid).items.keys()],
    })),
    "Quitar as fichas dos clientes selecionados",
  );
  desmarcarPendentes();
}
async function pagarTudo(cid) {
  await markGroups(
    [{ cid, ids: [...account(cid).items.keys()] }],
    "Quitar todas as fichas deste cliente",
  );
}
function renderLavados() {
  const usages = new Map();
  for (const f of db.lancamentos.filter((f) => !f.cancelada))
    usages.set(f.lavado, (usages.get(f.lavado) || 0) + 1);
  const services = [...db.lavados].sort((a, b) => a.nome.localeCompare(b.nome));
  $("tbl-lavados").innerHTML =
    services
      .map(
        (s) =>
          `<tr><td>${esc(s.nome)}${s.arquivado ? " (arquivado)" : ""}</td><td>${fmtC(cents(s.valor))}</td><td>${usages.get(s.nome) || 0}</td><td>${action("Preço", "editService", s.id, "btn-edit-sm")}${action(s.arquivado ? "Restaurar" : "Arquivar", "archiveService", s.id, "btn-danger-sm")}</td></tr>`,
      )
      .join("") || '<tr><td colspan="4">Cadastre o primeiro lavado</td></tr>';
}
async function salvarLavado() {
  const nome = $("lv-nome").value.trim(),
    valor = moneyInput($("lv-valor").value) / 100;
  if (!nome) throw new Error("Informe o nome.");
  if (
    db.lavados.some(
      (s) =>
        !s.arquivado &&
        s.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"),
    )
  )
    throw new Error("Lavado já cadastrado.");
  await saveService({ nome, valor, arquivado: false });
  $("lv-nome").value = "";
  $("lv-valor").value = "";
  toggleForm("form-lavado");
}
async function deletarLavado(id) {
  const s = db.lavados.find((s) => s.id === id);
  if (
    !confirm(
      `${s.arquivado ? "Restaurar" : "Arquivar"} o lavado ${s.nome}? As fichas existentes serão preservadas.`,
    )
  )
    return;
  await saveService(
    { arquivado: !s.arquivado, nome: s.nome, valor: s.valor },
    id,
  );
}
async function editarLavado(id) {
  const s = db.lavados.find((s) => s.id === id);
  const value = prompt(
    "Novo valor padrão (as fichas existentes mantêm o valor):",
    Number(s.valor).toFixed(2),
  );
  if (value === null) return;
  await saveService({ nome: s.nome, valor: moneyInput(value) / 100 }, id);
}
function abrirDetalheCliente(cid) {
  clienteDetalheId = cid;
  detailTab = "open";
  showPage("cliente-detalhe");
}
function renderDetalheCliente(cid) {
  const c = db.clientes.find((c) => c.id === cid);
  if (!c) {
    showPage("clientes");
    return;
  }
  const a = account(cid),
    items = [...a.items.values()].sort((a, b) => byDate(b, a));
  $("detalhe-header").innerHTML =
    `<div class="detail-identity"><div class="detalhe-avatar">${esc(initials(c.nome))}</div><div><div class="detail-name-line"><h1 class="detalhe-nome">${esc(c.nome)}</h1><span class="badge ${c.arquivado ? "badge-neutral" : a.due > 0 ? "badge-amber" : "badge-green"}">${c.arquivado ? "Arquivado" : a.due > 0 ? "Saldo pendente" : "Em dia"}</span></div><div class="detalhe-tel">${icon("phone")} ${esc(c.tel || "Sem telefone cadastrado")} <span>·</span> ${items.length} fichas</div></div></div><div class="detail-actions"><button class="btn-ghost" data-action="selectNote" data-id="${esc(cid)}">${icon("print")} Imprimir nota</button>${action("Registrar pagamento", "payment", cid, "btn-primary")}${actionMenu("Mais ações do cliente", action("Editar cliente", "editClient", cid, "menu-item") + (!c.arquivado ? action("Nova ficha", "newFicha", cid, "menu-item") : "") + action(c.arquivado ? "Restaurar cliente" : "Arquivar cliente", "archiveClient", cid, "menu-item danger"))}</div>`;
  $("detalhe-resumo").innerHTML =
    metric("Saldo a receber", fmtC(a.due), true) +
    metric("Total recebido", fmtC(a.received), false, "success") +
    metric(
      a.credit ? "Crédito disponível" : "Total lançado",
      fmtC(a.credit || a.total),
    );
  $("detail-help").innerHTML =
    a.available > 0
      ? `${icon("wallet")}<span><strong>${fmtC(a.available)} em pagamentos disponíveis.</strong> Ao marcar uma ficha como paga, esse valor é aproveitado antes de registrar um novo recebimento.</span>`
      : `${icon("check")}<span>Ao marcar como paga, a ficha é quitada e sai automaticamente da nota.</span>`;
  const open = items.filter((f) => !f.settled);
  $("detalhe-fichas-abertas").innerHTML =
    limited(open, "detail-open")
      .map((f) => fichaCard(f, true))
      .join("") || empty("Todas as fichas estão marcadas como pagas");
  $("detail-open-more").innerHTML = more(open, "detail-open");
  const payments = [...a.pagamentos].sort((a, b) => byDate(b, a));
  $("detalhe-pagamentos").innerHTML =
    limited(payments, "detail-payments")
      .map(
        (p) =>
          `<div class="pgto-card ${p.estornado ? "reversed" : ""}"><div><div class="pgto-card-info">${p.estornado ? "Pagamento estornado" : "Pagamento registrado"}</div><div class="pgto-card-data">${formatDate(p.data)}${p.motivoEstorno ? ` · ${esc(p.motivoEstorno)}` : ""}</div></div><div><span class="pgto-card-valor">${fmtC(cents(p.valor))}</span>${p.estornado ? "" : action("Estornar", "reverse", p.id, "btn-danger-sm")}</div></div>`,
      )
      .join("") || empty("Nenhum pagamento registrado");
  $("detail-payments-more").innerHTML = more(payments, "detail-payments");
  $("detalhe-todas-fichas").innerHTML =
    limited(items, "detail-all")
      .map((f) => fichaCard(f, true))
      .join("") || empty("Nenhuma ficha");
  $("detail-all-more").innerHTML = more(items, "detail-all");
  const paid = items.filter((f) => f.settled);
  $("detalhe-fichas-pagas").innerHTML =
    limited(paid, "detail-paid")
      .map((f) => fichaCard(f, true))
      .join("") || empty("As fichas quitadas aparecerão aqui.");
  $("detail-paid-more").innerHTML = more(paid, "detail-paid");
  for (const [tab, count] of Object.entries({
    open: open.length,
    paid: paid.length,
    payments: payments.filter((p) => !p.estornado).length,
    history: items.length,
  })) {
    $(`detail-count-${tab}`).textContent = count;
  }
  setDetailTab(detailTab);
  const canceled = a.fichas.filter((f) => f.cancelada);
  $("cancelled-fichas").innerHTML = canceled.length
    ? `<details><summary>${canceled.length} ficha(s) cancelada(s)</summary>${canceled.map((f) => `<p>${esc(f.peca)} · ${formatDate(f.data)} · ${fmtC(fichaCents(f))} ${action("Restaurar", "restoreFicha", f.id, "btn-ghost")}</p>`).join("")}</details>`
    : "";
}
function setDetailTab(tab) {
  detailTab = tab;
  document.querySelectorAll("[data-detail-tab]").forEach((button) => {
    button.setAttribute(
      "aria-selected",
      String(button.dataset.detailTab === tab),
    );
    button.tabIndex = button.dataset.detailTab === tab ? 0 : -1;
  });
  document
    .querySelectorAll("[data-detail-panel]")
    .forEach((panel) => (panel.hidden = panel.dataset.detailPanel !== tab));
}
function abrirModal(cid) {
  modalCid = cid;
  $("m-cliente").value = clientName(cid);
  $("m-aberto").value = fmtC(account(cid).due);
  $("m-valor").value = "";
  $("m-data").value = localDate();
  openModal("modal-bg");
}
function abrirModalDetalhe() {
  if (clienteDetalheId) abrirModal(clienteDetalheId);
}
function closeModal() {
  closeDialog("modal-bg");
  modalCid = null;
}
async function confirmarPagamento() {
  const cid = modalCid,
    amount = moneyInput($("m-valor").value, { positive: true }),
    data = $("m-data").value;
  if (!cid || !validDate(data))
    throw new Error("Informe cliente e data válidos.");
  const expected = account(cid).due;
  if (
    amount > expected &&
    !confirm(
      `Este pagamento deixará ${fmtC(amount - expected)} de crédito. Confirmar?`,
    )
  )
    return;
  const id = commandId(
    "confirmarPagamento",
    JSON.stringify({ cid, amount, data }),
  );
  await changeAccount(cid, ({ fichas, pagamentos }) => {
    if (pagamentos.some((p) => p.id === id)) return [];
    const current = statement(fichas, pagamentos);
    if (current.due !== expected)
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
          data,
          alocacoes: [],
          origem: "manual",
        },
      },
    ];
  });
  closeModal();
  notify("Pagamento registrado. Vincule-o às fichas usando Marcar como paga.");
}
async function markGroups(groups) {
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
        return [
          ...plan.updates.map((p) => ({
            col: "pagamentos",
            id: p.id,
            data: { alocacoes: p.alocacoes },
          })),
          ...plan.targets.map((fid) => ({
            col: "lancamentos",
            id: fid,
            data: { paga: true, pagaEm: localDate() },
          })),
          ...(plan.newAmount
            ? [
                {
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
                },
              ]
            : []),
        ];
      });
      completed++;
    }
    notify("Fichas marcadas como pagas. Elas não entrarão nas notas.");
  } catch (error) {
    throw new Error(
      `${completed ? `${completed} cliente(s) já concluído(s). ` : ""}${error.message}`,
    );
  }
}
async function marcarFichaPaga(id) {
  const f = db.lancamentos.find((f) => f.id === id);
  if (f)
    await markGroups([{ cid: f.cid, ids: [id] }], `Marcar ${f.peca} como paga`);
}
async function desmarcarFicha(id) {
  const f = db.lancamentos.find((f) => f.id === id);
  if (!f) return;
  if (
    !confirm(
      "Desmarcar esta ficha? Ela voltará à nota. Os pagamentos serão preservados e poderão ser vinculados novamente. Para desfazer uma entrada de dinheiro, use Estornar no pagamento.",
    )
  )
    return;
  await changeAccount(f.cid, ({ pagamentos }) => [
    ...allocationsWithout(pagamentos, id),
    { col: "lancamentos", id, data: { paga: false, pagaEm: null } },
  ]);
}
async function estornarPagamento(id) {
  const p = db.pagamentos.find((p) => p.id === id);
  if (!p || p.estornado) return;
  const motivo = prompt(
    `Estornar ${fmtC(cents(p.valor))}? Informe o motivo. As fichas vinculadas serão reabertas.`,
  );
  if (motivo === null) return;
  if (!motivo.trim()) throw new Error("Informe o motivo do estorno.");
  await changeAccount(p.cid, ({ pagamentos, fichas }) => {
    const payment = pagamentos.find((p) => p.id === id);
    if (payment?.estornado) return [];
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
        .map((a) => ({ col: "lancamentos", id: a.fid, data: { paga: false } })),
    ];
  });
  notify("Pagamento estornado; histórico preservado.");
}
async function restaurarFicha(id) {
  const f = db.lancamentos.find((f) => f.id === id);
  if (!confirm("Restaurar esta ficha como não paga?")) return;
  await changeAccount(f.cid, () => [
    { col: "lancamentos", id, data: { cancelada: false, paga: false } },
  ]);
}
function abrirSelecaoNota() {
  const a = account(clienteDetalheId);
  const items = noteItems(a.fichas, a.pagamentos);
  if (!items.length) {
    notify("Não há fichas não pagas para imprimir.");
    return;
  }
  selectedNotes.clear();
  items.forEach((f) => selectedNotes.add(f.id));
  $("nota-sel-list").innerHTML = items
    .map(
      (f) =>
        `<label class="note-row"><input type="checkbox" class="chk-nota" data-id="${esc(f.id)}" checked><span>${fmtN(f.qtd)} × ${esc(f.peca)} · ${esc(f.lavado)}<small>${formatDate(f.data)}${f.paid ? ` · Já vinculado: ${fmtC(f.paid)}` : ""}</small></span><strong>${fmtC(f.due)}</strong></label>`,
    )
    .join("");
  atualizarTotalSelecaoNota();
  openModal("nota-sel-bg");
}
function atualizarTotalSelecaoNota() {
  const a = account(clienteDetalheId);
  $("nota-sel-total").textContent = fmtC(
    noteItems(a.fichas, a.pagamentos, [...selectedNotes]).reduce(
      (s, f) => s + f.due,
      0,
    ),
  );
}
function fecharSelecaoNota() {
  closeDialog("nota-sel-bg");
}
async function confirmarSelecaoNota() {
  if (!selectedNotes.size) throw new Error("Selecione pelo menos uma ficha.");
  await imprimirNota([...selectedNotes]);
}
async function imprimirNota(ids) {
  const cid = clienteDetalheId;
  if (!cid) return;
  // Abrir ainda no clique evita bloqueio de pop-up depois da consulta assíncrona.
  const win = window.open("", "_blank");
  if (!win)
    throw new Error("Permita abrir uma nova aba para visualizar a nota.");
  win.opener = null;
  win.document.body.textContent = "Preparando nota…";
  try {
    let fresh;
    await changeAccount(cid, (data) => {
      fresh = data;
      return [];
    });
    const items = noteItems(fresh.fichas, fresh.pagamentos, ids);
    if (!items.length) {
      win.close();
      notify("As fichas selecionadas já foram pagas. Nenhuma nota foi gerada.");
      fecharSelecaoNota();
      return;
    }
    // Incorporar o logo torna a nota independente de novas requisições na aba de impressão.
    const logoResponse = await fetch(
      new URL("img/logo-nova-lavanderia.png", location.href),
    );
    if (!logoResponse.ok)
      throw new Error("Não foi possível carregar o logo da nota.");
    const logoBlob = await logoResponse.blob();
    const logo = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () =>
        reject(new Error("Não foi possível preparar o logo da nota."));
      reader.readAsDataURL(logoBlob);
    });
    win.document.open();
    win.document.write(
      renderNote({ client: fresh.client, items, logo, date: localDate() }),
    );
    win.document.close();
    win.document
      .getElementById("print-note")
      .addEventListener("click", async () => {
        const images = [...win.document.images];
        await Promise.all(
          images.map((image) =>
            image.complete
              ? Promise.resolve()
              : new Promise((resolve) => {
                  image.addEventListener("load", resolve, { once: true });
                  image.addEventListener("error", resolve, { once: true });
                }),
          ),
        );
        if (images.some((image) => !image.naturalWidth)) {
          win.alert(
            "Não foi possível carregar o logo. Reabra a nota antes de imprimir.",
          );
          return;
        }
        await win.document.fonts.ready;
        win.print();
      });
    fecharSelecaoNota();
  } catch (error) {
    win.close();
    throw error;
  }
}
let previousFocus = null;
function openModal(id) {
  previousFocus = document.activeElement;
  const el = $(id);
  el.style.display = "flex";
  document
    .querySelectorAll(
      "#app-admin > aside,#app-admin > header,#app-admin > main,#app-admin > nav",
    )
    .forEach((el) => (el.inert = true));
  el.querySelector("input:not([disabled]),select,button")?.focus();
}
function closeDialog(id) {
  $(id).style.display = "none";
  document
    .querySelectorAll(
      "#app-admin > aside,#app-admin > header,#app-admin > main,#app-admin > nav",
    )
    .forEach((el) => (el.inert = false));
  previousFocus?.focus();
}
function configureAccessibility() {
  document.querySelectorAll(".form-group").forEach((group) => {
    const input = group.querySelector("input,select"),
      label = group.querySelector("label");
    if (input?.id && label) label.htmlFor = input.id;
  });
  for (const id of [
    "modal-bg",
    "modal-edit-bg",
    "nota-sel-bg",
    "client-edit-bg",
  ]) {
    const modal = $(id).querySelector(".modal");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    const title = modal.querySelector(".modal-title");
    title.id = `${id}-title`;
    modal.setAttribute("aria-labelledby", title.id);
  }
  document.addEventListener("keydown", (event) => {
    const el = ["nota-sel-bg", "modal-edit-bg", "modal-bg", "client-edit-bg"]
      .map($)
      .find((el) => el.style.display === "flex");
    if (!el) return;
    if (event.key === "Escape" && !busy.size) {
      if (el.id === "modal-bg") closeModal();
      else if (el.id === "modal-edit-bg") closeEditModal();
      else if (el.id === "client-edit-bg") closeClientEditor();
      else fecharSelecaoNota();
    }
    if (event.key === "Tab") {
      const list = [
        ...el.querySelectorAll("button,input:not([disabled]),select,a[href]"),
      ].filter((el) => !el.disabled);
      if (!list.length) return;
      const first = list[0],
        last = list.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
}
const staticActions = {
  closeClientEditor,
  saveClientEditor,
  showPage,
  toggleForm,
  salvarCliente,
  deletarCliente,
  salvarLancamento,
  deletarLanc,
  updatePreview,
  renderLancamentos,
  salvarLavado,
  deletarLavado,
  renderRelatorio,
  renderPendentes,
  abrirModal,
  closeModal,
  confirmarPagamento,
  pagarTudo,
  toggleAllChk,
  desmarcarTodos,
  marcarSelecionadosPago,
  updateBulkActions,
  toggleAllPendChk,
  desmarcarPendentes,
  marcarPendentesPago,
  updatePendBulk,
  abrirDetalheCliente,
  abrirModalDetalhe,
  editarFicha,
  closeEditModal,
  salvarEdicaoFicha,
  updateEditPreview: () => updatePreview("e"),
  imprimirNota,
  setPeriodo,
  abrirSelecaoNota,
  fecharSelecaoNota,
  confirmarSelecaoNota,
  atualizarTotalSelecaoNota,
};
const mutations = new Set([
  "saveClientEditor",
  "salvarCliente",
  "deletarCliente",
  "salvarLancamento",
  "deletarLanc",
  "salvarLavado",
  "deletarLavado",
  "confirmarPagamento",
  "pagarTudo",
  "marcarSelecionadosPago",
  "marcarPendentesPago",
  "salvarEdicaoFicha",
  "imprimirNota",
  "confirmarSelecaoNota",
]);
for (const [name, fn] of Object.entries(staticActions))
  window[name] = (...args) => {
    if (mutations.has(name)) return execute(name, () => fn(...args));
    try {
      return fn(...args);
    } catch (error) {
      notify(error.message, true);
    }
  };
const actions = {
  detail: abrirDetalheCliente,
  payment: abrirModal,
  editClient: editarCliente,
  archiveClient: deletarCliente,
  editFicha: editarFicha,
  deleteFicha: deletarLanc,
  payFicha: marcarFichaPaga,
  unmarkFicha: desmarcarFicha,
  restoreFicha: restaurarFicha,
  settle: pagarTudo,
  editService: editarLavado,
  archiveService: deletarLavado,
  reverse: estornarPagamento,
  selectNote: abrirSelecaoNota,
  newFicha: (cid) => {
    showPage("lancamentos");
    $("form-lanc").style.display = "none";
    toggleForm("form-lanc", cid);
  },
  more: (key) => {
    limits.set(key, (limits.get(key) || PAGE_SIZE) + PAGE_SIZE);
    renderPage();
  },
};
const readActions = new Set([
  "editClient",
  "detail",
  "payment",
  "editFicha",
  "selectNote",
  "newFicha",
  "more",
]);
document.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-action]");
  if (!btn) return;
  const { action: name, id } = btn.dataset;
  const fn = actions[name];
  if (!fn) return;
  const menu = btn.closest("details");
  if (menu) menu.open = false;
  if (readActions.has(name)) {
    try {
      fn(id);
    } catch (error) {
      notify(error.message, true);
    }
  } else execute(`${name}:${id}`, () => fn(id));
});
document.addEventListener("change", (event) => {
  const el = event.target;
  if (el.matches(".chk-rel,.chk-pend")) {
    const set = el.matches(".chk-rel") ? selectedReport : selectedPending;
    if (el.checked) set.add(el.dataset.cid);
    else set.delete(el.dataset.cid);
    updateBulkActions();
    updatePendBulk();
  }
  if (el.matches(".chk-nota")) {
    if (el.checked) selectedNotes.add(el.dataset.id);
    else selectedNotes.delete(el.dataset.id);
    atualizarTotalSelecaoNota();
  }
});
$("l-lavado").addEventListener("change", () => applyServicePrice("l"));
$("e-lavado").addEventListener("change", () => applyServicePrice("e"));
$("f-ano").addEventListener("change", renderLancamentos);
for (const id of ["r-mes", "r-ano", "r-semana-inicio", "r-semana-fim"])
  $(id).addEventListener("change", () => {
    selectedReport.clear();
    renderRelatorio();
  });
$("client-search").addEventListener("input", () => {
  limits.delete("clientes");
  renderClientes();
});
$("show-archived").addEventListener("change", (event) => {
  showArchived = event.target.checked;
  renderClientes();
});
$("reconnect").addEventListener("click", () => {
  $("app-message").hidden = true;
  startListeners();
});
$("dismiss-message").addEventListener("click", () => {
  $("app-message").hidden = true;
});
$("note-select-all").addEventListener("click", () => {
  document.querySelectorAll(".chk-nota").forEach((el) => {
    el.checked = true;
    selectedNotes.add(el.dataset.id);
  });
  atualizarTotalSelecaoNota();
});
$("note-select-none").addEventListener("click", () => {
  selectedNotes.clear();
  document.querySelectorAll(".chk-nota").forEach((el) => (el.checked = false));
  atualizarTotalSelecaoNota();
});
$("export-data").addEventListener("click", () => {
  const blob = new Blob(
    [JSON.stringify({ exportadoEm: new Date().toISOString(), ...db }, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `lavanderia-backup-${localDate()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$("client-sort").addEventListener("change", renderClientes);
document.querySelectorAll("[data-client-filter]").forEach((button) =>
  button.addEventListener("click", () => {
    clientFilter = button.dataset.clientFilter;
    limits.delete("clientes");
    document
      .querySelectorAll("[data-client-filter]")
      .forEach((el) => el.setAttribute("aria-pressed", String(el === button)));
    renderClientes();
  }),
);
document
  .querySelectorAll("[data-detail-tab]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      setDetailTab(button.dataset.detailTab),
    ),
  );
$("detail-tabs").addEventListener("keydown", (event) => {
  const tabs = [...document.querySelectorAll("[data-detail-tab]")];
  const current = tabs.indexOf(document.activeElement);
  if (current < 0) return;
  const next =
    event.key === "ArrowRight"
      ? (current + 1) % tabs.length
      : event.key === "ArrowLeft"
        ? (current + tabs.length - 1) % tabs.length
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : -1;
  if (next >= 0) {
    event.preventDefault();
    tabs[next].click();
    tabs[next].focus();
  }
});
document.addEventListener("click", (event) => {
  document.querySelectorAll(".action-menu[open]").forEach((menu) => {
    if (!menu.contains(event.target) || event.target.closest("button"))
      menu.open = false;
  });
});
configureAccessibility();
showLoading("Conectando…");
garantirAcesso()
  .then(startListeners)
  .catch((error) => {
    hideLoading();
    notify(`Não foi possível iniciar: ${error.message}`, true);
  });
