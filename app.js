/* ===== FIREBASE ===== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, deleteDoc,
  onSnapshot, getDocs, writeBatch
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDleTdgPI0bvoVN4DYNd6J5yZ9DU15dIn4",
  authDomain: "lavanderia-emanoel.firebaseapp.com",
  projectId: "lavanderia-emanoel",
  storageBucket: "lavanderia-emanoel.firebasestorage.app",
  messagingSenderId: "165346573574",
  appId: "1:165346573574:web:2380641264cd502ccb7287"
};

const fireApp = initializeApp(firebaseConfig);
const db_fire = getFirestore(fireApp);
const auth    = getAuth(fireApp);

/* ===== MAPEAMENTO USUARIO → ROLE
   Chave: email usado no Firebase Auth
   Valor: { role, nome }
   Adicione ou altere aqui se criar mais usuarios ===== */
const ROLES = {
  'admin@lavanderia.com':       { role: 'admin',       nome: 'Admin' },
  'funcionario@lavanderia.com': { role: 'funcionario', nome: 'Funcionario' },
};

/* ===== ESTADO ===== */
let db = { clientes: [], lancamentos: [], pagamentos: [], lavados: [] };
let appReady     = false;
let paginaAtual  = 'dashboard';
let roleAtual    = null;   // 'admin' | 'funcionario'
let unsubListeners = [];   // para cancelar listeners ao fazer logout

/* ===== SANITIZACAO XSS ===== */
function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str ?? '')));
  return d.innerHTML;
}

/* ===== SERVICOS INICIAIS ===== */
const LAVADOS_INICIAIS = [
  { id: 'lv1', nome: 'Marmorizado',     valor: 3.50 },
  { id: 'lv2', nome: 'Destroyed',       valor: 3.00 },
  { id: 'lv3', nome: 'Hiper Destroyed', valor: 3.30 },
  { id: 'lv4', nome: 'Amaciado',        valor: 1.50 },
  { id: 'lv5', nome: 'Engomado',        valor: 2.00 },
];

/* ===== LOADING ===== */
function showLoading(msg = 'Carregando...') {
  document.getElementById('loading-overlay').style.display = 'flex';
  document.getElementById('loading-msg').textContent = msg;
}
function hideLoading() {
  document.getElementById('loading-overlay').style.display = 'none';
}

/* ===== LOGIN / LOGOUT ===== */
function mostrarLogin() {
  document.getElementById('loading-overlay').style.display  = 'none';
  document.getElementById('login-screen').style.display     = 'flex';
  document.getElementById('app-admin').style.display        = 'none';
  document.getElementById('app-funcionario').style.display  = 'none';
}

function toggleSenha() {
  const input = document.getElementById('login-pass');
  const icon  = document.getElementById('eye-icon');
  if (input.type === 'password') {
    input.type = 'text';
    icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
  } else {
    input.type = 'password';
    icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  }
}

async function fazerLogin() {
  const usuario = document.getElementById('login-user').value.trim().toLowerCase();
  const senha   = document.getElementById('login-pass').value;
  const erroEl  = document.getElementById('login-erro');
  erroEl.style.display = 'none';

  if (!usuario || !senha) {
    erroEl.textContent = 'Preencha usuario e senha.';
    erroEl.style.display = 'block';
    return;
  }

  // Monta email interno a partir do usuario digitado
  // Se o usuario ja tiver @, usa como esta; senao adiciona @lavanderia.com
  const email = usuario.includes('@') ? usuario : `${usuario}@lavanderia.com`;

  const btn = document.querySelector('.btn-login');
  btn.textContent = 'Entrando...';
  btn.disabled = true;

  try {
    await signInWithEmailAndPassword(auth, email, senha);
    // onAuthStateChanged cuida do resto
  } catch (e) {
    erroEl.textContent = 'Usuario ou senha incorretos.';
    erroEl.style.display = 'block';
    btn.textContent = 'Entrar';
    btn.disabled = false;
  }
}

// Enter no campo de senha faz login
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-pass')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') fazerLogin();
  });
  document.getElementById('login-user')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-pass').focus();
  });
});

async function fazerLogout() {
  if (!confirm('Deseja sair do sistema?')) return;
  // Cancela listeners antes de sair
  unsubListeners.forEach(fn => fn());
  unsubListeners = [];
  appReady = false;
  db = { clientes: [], lancamentos: [], pagamentos: [], lavados: [] };
  await signOut(auth);
}

/* ===== AUTH STATE ===== */
onAuthStateChanged(auth, async usuario => {
  if (!usuario) {
    mostrarLogin();
    return;
  }

  showLoading('Verificando acesso...');

  const info = ROLES[usuario.email];
  if (!info) {
    // Email nao mapeado — nega acesso
    await signOut(auth);
    document.getElementById('login-erro').textContent = 'Acesso nao autorizado.';
    document.getElementById('login-erro').style.display = 'block';
    mostrarLogin();
    return;
  }

  roleAtual = info.role;

  // Atualiza nome na sidebar
  const usernameEl = document.getElementById('sidebar-username');
  if (usernameEl) usernameEl.textContent = info.nome;

  // Reseta botao de login
  const btn = document.querySelector('.btn-login');
  if (btn) { btn.textContent = 'Entrar'; btn.disabled = false; }
  document.getElementById('login-screen').style.display = 'none';

  await migrarDadosIniciais();
  iniciarListeners();
});

/* ===== MIGRACAO INICIAL ===== */
async function migrarDadosIniciais() {
  const snap = await getDocs(collection(db_fire, 'lavados'));
  if (!snap.empty) return;
  showLoading('Configurando...');
  const batch = writeBatch(db_fire);
  LAVADOS_INICIAIS.forEach(lv => batch.set(doc(db_fire, 'lavados', lv.id), lv));
  await batch.commit();
}

/* ===== LISTENERS REALTIME ===== */
function iniciarListeners() {
  let counts = { clientes: false, lancamentos: false, pagamentos: false, lavados: false };

  function check() {
    if (Object.values(counts).every(Boolean) && !appReady) {
      appReady = true;
      hideLoading();
      inicializarApp();
    }
  }

  const u1 = onSnapshot(collection(db_fire, 'clientes'),    s => { db.clientes    = s.docs.map(d => ({ ...d.data(), id: d.id })); counts.clientes    = true; check(); if (appReady) refreshCurrentPage(); });
  const u2 = onSnapshot(collection(db_fire, 'lancamentos'), s => { db.lancamentos = s.docs.map(d => ({ ...d.data(), id: d.id })); counts.lancamentos = true; check(); if (appReady) refreshCurrentPage(); });
  const u3 = onSnapshot(collection(db_fire, 'pagamentos'),  s => { db.pagamentos  = s.docs.map(d => ({ ...d.data(), id: d.id })); counts.pagamentos  = true; check(); if (appReady) refreshCurrentPage(); });
  const u4 = onSnapshot(collection(db_fire, 'lavados'),     s => { db.lavados     = s.docs.map(d => ({ ...d.data(), id: d.id })); counts.lavados     = true; check(); if (appReady) { populateLavadoSelects(); refreshCurrentPage(); } });

  unsubListeners = [u1, u2, u3, u4];
}

/* ===== FIRESTORE HELPERS ===== */
function gerarId() { return Date.now().toString(36) + Math.random().toString(36).substring(2, 6); }
async function salvarDoc(col, id, dados) { await setDoc(doc(db_fire, col, id), dados); }
async function deletarDoc(col, id) { await deleteDoc(doc(db_fire, col, id)); }

/* ===== HELPERS ===== */
const MESES = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function fmt(v)  { return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtN(v) { return Number(v).toLocaleString('pt-BR'); }
function mesAtual()  { return String(new Date().getMonth() + 1).padStart(2, '0'); }
function anoAtual()  { return String(new Date().getFullYear()); }
function hojeISO()   { return new Date().toISOString().split('T')[0]; }
function nomeCliente(id) { const c = db.clientes.find(x => x.id == id); return c ? c.nome : '?'; }
function initials(nome) { return String(nome).split(' ').map(x => x[0]).filter(Boolean).join('').substring(0, 2).toUpperCase(); }
function totalLanc(cid)   { return db.lancamentos.filter(l => l.cid == cid).reduce((s, l) => s + l.qtd * l.valor, 0); }
function totalPago(cid)   { return db.pagamentos.filter(p => p.cid == cid).reduce((s, p) => s + p.valor, 0); }
function totalAberto(cid) { return Math.max(0, totalLanc(cid) - totalPago(cid)); }
function formatDate(iso)  { return iso.split('-').reverse().join('/'); }
function lancsMes(mes, ano)         { return db.lancamentos.filter(l => l.data.substring(5,7) === mes && l.data.substring(0,4) === ano); }
function lancsIntervalo(ini, fim)   { return db.lancamentos.filter(l => l.data >= ini && l.data <= fim); }
function pecasDeCliente(cid, lancs) { return lancs.filter(l => l.cid == cid).reduce((s, l) => s + l.qtd, 0); }
function fatDeCliente(cid, lancs)   { return lancs.filter(l => l.cid == cid).reduce((s, l) => s + l.qtd * l.valor, 0); }

/* ===== INICIALIZACAO ===== */
function inicializarApp() {
  if (roleAtual === 'funcionario') {
    inicializarFuncionario();
    return;
  }
  // ADMIN — CSS cuida do layout, JS só inicializa dados
  // Mostra o app removendo o inline display:none — CSS @media define o valor correto
  document.getElementById('app-admin').removeAttribute('style');

  const mes  = mesAtual();
  const rMes = document.getElementById('r-mes');
  if (rMes) rMes.value = mes;
  populateAnoSelect();

  const sw  = semanaAtual();
  const ini = document.getElementById('r-semana-inicio');
  const fim = document.getElementById('r-semana-fim');
  if (ini) ini.value = sw.ini;
  if (fim) fim.value = sw.fim;

  const lData = document.getElementById('l-data');
  if (lData) lData.value = hojeISO();

  populateLavadoSelects();
  populateSelects();
  renderDashboard();
}

/* ===== FUNCIONARIO ===== */
function inicializarFuncionario() {
  document.getElementById('app-funcionario').style.display = 'block';

  // Data de hoje
  const dEl = document.getElementById('f-data-func');
  if (dEl) dEl.value = hojeISO();

  // Popula selects do funcionario
  popularSelectFuncCliente();
  popularSelectFuncLavado();
  renderFichasHoje();
}

function popularSelectFuncCliente() {
  const sel = document.getElementById('f-cliente-func');
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione o cliente...</option>';
  [...db.clientes].sort((a, b) => a.nome.localeCompare(b.nome)).forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.nome;
    sel.appendChild(o);
  });
}

function popularSelectFuncLavado() {
  const sel = document.getElementById('f-lavado-func');
  if (!sel) return;
  sel.innerHTML = '';
  [...db.lavados].sort((a, b) => a.nome.localeCompare(b.nome)).forEach(lv => {
    const o = document.createElement('option');
    o.value = lv.nome; o.textContent = lv.nome;
    sel.appendChild(o);
  });
}

async function salvarFichaFunc() {
  const cid   = document.getElementById('f-cliente-func').value;
  const data  = document.getElementById('f-data-func').value;
  const peca  = document.getElementById('f-peca-func').value.trim();
  const lavado= document.getElementById('f-lavado-func').value;
  const qtd   = parseInt(document.getElementById('f-qtd-func').value);
  const erroEl = document.getElementById('func-erro');
  const okEl   = document.getElementById('func-ok');
  erroEl.style.display = 'none';
  okEl.style.display   = 'none';

  if (!cid || !data || !peca || !qtd || qtd <= 0) {
    erroEl.textContent = 'Preencha todos os campos.';
    erroEl.style.display = 'block';
    return;
  }

  // Pega o valor do servico cadastrado pelo admin
  const lavadoDoc = db.lavados.find(lv => lv.nome === lavado);
  const valor = lavadoDoc ? lavadoDoc.valor : 0;

  const id = gerarId();
  await salvarDoc('lancamentos', id, { id, cid, data, peca, lavado, qtd, valor });

  // Limpa form
  document.getElementById('f-peca-func').value = '';
  document.getElementById('f-qtd-func').value  = '';
  document.getElementById('f-cliente-func').value = '';
  okEl.style.display = 'block';
  setTimeout(() => { okEl.style.display = 'none'; }, 3000);
  renderFichasHoje();
}

function renderFichasHoje() {
  const container = document.getElementById('func-fichas-hoje');
  if (!container) return;
  const hoje = hojeISO();
  const fichas = [...db.lancamentos]
    .filter(l => l.data === hoje)
    .sort((a, b) => b.id.localeCompare(a.id));

  if (fichas.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-4);font-size:.82rem">Nenhuma ficha lancada hoje</div>';
    return;
  }
  container.innerHTML = fichas.map(l => `
    <div class="lanc-card">
      <div class="lanc-card-left">
        <div class="lanc-card-peca">${esc(l.peca)}</div>
        <div class="lanc-card-meta">${esc(nomeCliente(l.cid))} &middot; ${esc(fmtN(l.qtd))} pecas</div>
        <span class="lanc-tipo-chip">${esc(l.lavado)}</span>
      </div>
      <div class="lanc-card-right">
        <div class="lanc-card-date">${esc(formatDate(l.data))}</div>
      </div>
    </div>`).join('');
}

/* ===== NAVEGACAO (admin) ===== */
function showPage(id) {
  paginaAtual = id;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('[data-page]').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll(`[data-page="${id}"]`).forEach(b => b.classList.add('active'));
  ({ dashboard: renderDashboard, clientes: renderClientes, lancamentos: renderLancamentos, relatorio: renderRelatorio, pendentes: renderPendentes, lavados: renderLavados })[id]?.();
}

function refreshCurrentPage() {
  if (roleAtual === 'funcionario') {
    popularSelectFuncCliente();
    popularSelectFuncLavado();
    renderFichasHoje();
    return;
  }
  const map = { dashboard: renderDashboard, clientes: renderClientes, lancamentos: renderLancamentos, relatorio: renderRelatorio, pendentes: renderPendentes, lavados: renderLavados, 'cliente-detalhe': () => {} };
  map[paginaAtual]?.();
}

/* ===== FORMS (admin) ===== */
function toggleForm(id, preSelectCid) {
  const el = document.getElementById(id);
  const isHidden = el.style.display === 'none' || el.style.display === '';
  el.style.display = isHidden ? 'block' : 'none';
  if (isHidden) {
    populateSelects();
    populateLavadoSelects();
    if (preSelectCid) {
      const sel = document.getElementById('l-cliente');
      if (sel) sel.value = preSelectCid;
    }
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }
}

function populateSelects() {
  ['l-cliente', 'f-cliente'].forEach(sid => {
    const sel = document.getElementById(sid);
    if (!sel) return;
    const val = sel.value;
    sel.innerHTML = sid === 'f-cliente'
      ? '<option value="">Todos os clientes</option>'
      : '<option value="">Selecione...</option>';
    [...db.clientes].sort((a, b) => a.nome.localeCompare(b.nome)).forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = c.nome;
      sel.appendChild(o);
    });
    if (val) sel.value = val;
  });
}

function populateLavadoSelects() {
  ['l-lavado', 'e-lavado'].forEach(sid => {
    const sel = document.getElementById(sid);
    if (!sel) return;
    const val = sel.value;
    sel.innerHTML = '';
    [...db.lavados].sort((a, b) => a.nome.localeCompare(b.nome)).forEach(lv => {
      const o = document.createElement('option');
      o.value = lv.nome; o.textContent = lv.nome;
      sel.appendChild(o);
    });
    if (val) sel.value = val;
  });
}

/* ===== DASHBOARD ===== */
function renderDashboard() {
  const hoje = new Date();
  const elDate = document.getElementById('dash-date');
  if (elDate) elDate.textContent = hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const mes = mesAtual(); const ano = anoAtual();
  const totalFat = db.lancamentos.reduce((s, l) => s + l.qtd * l.valor, 0);
  const totalAb  = db.clientes.reduce((s, c) => s + totalAberto(c.id), 0);
  const totalPcs = db.lancamentos.reduce((s, l) => s + l.qtd, 0);
  const fatMesAt = lancsMes(mes, ano).reduce((s, l) => s + l.qtd * l.valor, 0);

  document.getElementById('metrics-cards').innerHTML = `
    <div class="metric"><div class="lbl">Faturamento total</div><div class="val">${esc(fmt(totalFat))}</div></div>
    <div class="metric"><div class="lbl">Em aberto</div><div class="val danger">${esc(fmt(totalAb))}</div></div>
    <div class="metric"><div class="lbl">Total de pecas</div><div class="val">${esc(fmtN(totalPcs))}</div></div>
    <div class="metric"><div class="lbl">${esc(MESES[parseInt(mes)-1])}</div><div class="val">${esc(fmt(fatMesAt))}</div></div>`;

  let rowsAberto = '';
  [...db.clientes].sort((a,b) => totalAberto(b.id) - totalAberto(a.id)).forEach(c => {
    const tot = totalLanc(c.id); if (tot === 0) return;
    const ab = totalAberto(c.id);
    const badge = ab === 0 ? '<span class="badge badge-green">Pago</span>' : ab < 500 ? '<span class="badge badge-amber">Parcial</span>' : '<span class="badge badge-red">Aberto</span>';
    rowsAberto += `<tr><td><div class="client-row"><div class="avatar">${esc(initials(c.nome))}</div>${esc(c.nome)}</div></td><td>${esc(fmt(tot))}</td><td>${esc(fmt(ab))}</td><td>${badge}</td></tr>`;
  });
  document.getElementById('tbl-aberto').innerHTML = rowsAberto || '<tr class="empty-row"><td colspan="4">Nenhuma ficha cadastrada</td></tr>';

  let rowsUlt = '';
  [...db.lancamentos].sort((a,b) => b.id.localeCompare(a.id)).slice(0,6).forEach(l => {
    rowsUlt += `<tr><td>${esc(formatDate(l.data))}</td><td>${esc(nomeCliente(l.cid))}</td><td>${esc(l.peca)}</td><td>${esc(fmtN(l.qtd))}</td><td>${esc(fmt(l.qtd*l.valor))}</td></tr>`;
  });
  document.getElementById('tbl-ultimos').innerHTML = rowsUlt || '<tr class="empty-row"><td colspan="5">Nenhuma ficha</td></tr>';
}

/* ===== CLIENTES ===== */
function renderClientes() {
  populateSelects();
  const mes = mesAtual(); const ano = anoAtual();
  const list = document.getElementById('client-list');
  if (db.clientes.length === 0) { list.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-4);font-size:.85rem">Nenhum cliente cadastrado</div>'; return; }
  list.innerHTML = [...db.clientes].sort((a,b) => a.nome.localeCompare(b.nome)).map(c => {
    const pm = pecasDeCliente(c.id, lancsMes(mes, ano));
    const tot = totalLanc(c.id); const ab = totalAberto(c.id);
    return `<div class="client-card" onclick="abrirDetalheCliente('${esc(c.id)}')" style="cursor:pointer">
      <div class="avatar" style="width:40px;height:40px;font-size:13px;flex-shrink:0">${esc(initials(c.nome))}</div>
      <div class="client-card-info">
        <div class="client-card-name">${esc(c.nome)}</div>
        <div class="client-card-stats"><span class="client-card-stat">${esc(c.tel||'Sem telefone')}</span><span class="client-card-stat">Mes: <span>${esc(fmtN(pm))} pc</span></span></div>
        <div style="font-size:.7rem;color:var(--text-3);margin-top:3px">Total: <strong style="color:var(--text-1)">${esc(fmt(tot))}</strong></div>
      </div>
      <div class="client-card-actions">
        <span class="client-ab ${ab===0?'zero':''}">${ab===0?'Pago':esc(fmt(ab))}</span>
        <button class="btn-quitar" onclick="event.stopPropagation();abrirModal('${esc(c.id)}')">Pagamento</button>
        <button class="btn-danger-sm" onclick="event.stopPropagation();deletarCliente('${esc(c.id)}')">Remover</button>
      </div>
    </div>`;
  }).join('');
}

async function salvarCliente() {
  const nome = document.getElementById('c-nome').value.trim();
  const tel  = document.getElementById('c-tel').value.trim();
  if (!nome) { alert('Digite o nome do cliente.'); return; }
  const id = gerarId();
  await salvarDoc('clientes', id, { id, nome, tel });
  document.getElementById('c-nome').value = '';
  document.getElementById('c-tel').value  = '';
  toggleForm('form-cliente');
}

async function deletarCliente(id) {
  if (!confirm(`Remover "${nomeCliente(id)}" e todos os dados vinculados?`)) return;
  const batch = writeBatch(db_fire);
  batch.delete(doc(db_fire, 'clientes', id));
  db.lancamentos.filter(l => l.cid==id).forEach(l => batch.delete(doc(db_fire,'lancamentos',l.id)));
  db.pagamentos.filter(p => p.cid==id).forEach(p => batch.delete(doc(db_fire,'pagamentos',p.id)));
  await batch.commit();
}

/* ===== FICHAS ===== */
function renderLancamentos() {
  populateSelects();
  const fcid = document.getElementById('f-cliente').value;
  const fmes = document.getElementById('f-mes').value;
  let lancs  = [...db.lancamentos].sort((a,b) => b.id.localeCompare(a.id));
  if (fcid) lancs = lancs.filter(l => l.cid==fcid);
  if (fmes) lancs = lancs.filter(l => l.data.substring(5,7)===fmes);
  const container = document.getElementById('lanc-list');
  if (lancs.length===0) { container.innerHTML='<div style="text-align:center;padding:3rem;color:var(--text-4);font-size:.85rem">Nenhuma ficha encontrada</div>'; return; }
  const total = lancs.reduce((s,l)=>s+l.qtd*l.valor,0);
  const pecas = lancs.reduce((s,l)=>s+l.qtd,0);
  container.innerHTML = lancs.map(l=>`
    <div class="lanc-card">
      <div class="lanc-card-left">
        <div class="lanc-card-peca">${esc(l.peca)}</div>
        <div class="lanc-card-meta">${esc(nomeCliente(l.cid))} &middot; ${esc(fmtN(l.qtd))} pecas</div>
        <span class="lanc-tipo-chip">${esc(l.lavado)}</span>
      </div>
      <div class="lanc-card-right">
        <div class="lanc-card-total">${esc(fmt(l.qtd*l.valor))}</div>
        <div class="lanc-card-date">${esc(formatDate(l.data))}</div>
        <div style="display:flex;gap:5px;margin-top:6px;justify-content:flex-end">
          <button class="btn-edit-sm" onclick="editarFicha('${esc(l.id)}')">Editar</button>
          <button class="btn-danger-sm" onclick="deletarLanc('${esc(l.id)}')">Remover</button>
        </div>
      </div>
    </div>`).join('') +
    `<div class="card" style="padding:11px 14px;display:flex;justify-content:space-between;align-items:center;margin-top:4px">
      <span style="font-size:.73rem;color:var(--text-3);font-weight:600">${esc(fmtN(pecas))} pecas &middot; ${esc(String(lancs.length))} itens</span>
      <span style="font-size:.88rem;font-weight:700;color:var(--text-1)">${esc(fmt(total))}</span>
    </div>`;
}

function updatePreview() {
  const qtd = parseInt(document.getElementById('l-qtd').value)||0;
  const val = parseFloat(document.getElementById('l-valor').value)||0;
  document.getElementById('l-preview').textContent = qtd*val>0 ? `Total: ${fmt(qtd*val)}` : '';
}

async function salvarLancamento() {
  const cid=document.getElementById('l-cliente').value, data=document.getElementById('l-data').value,
        peca=document.getElementById('l-peca').value.trim(), lavado=document.getElementById('l-lavado').value,
        qtd=parseInt(document.getElementById('l-qtd').value), valor=parseFloat(document.getElementById('l-valor').value);
  if (!cid||!data||!peca||!qtd||!valor) { alert('Preencha todos os campos.'); return; }
  const id=gerarId();
  await salvarDoc('lancamentos',id,{id,cid,data,peca,lavado,qtd,valor});
  document.getElementById('l-peca').value=''; document.getElementById('l-qtd').value='';
  document.getElementById('l-valor').value=''; document.getElementById('l-preview').textContent='';
  toggleForm('form-lanc');
}

async function deletarLanc(id) {
  if (!confirm('Remover esta ficha?')) return;
  await deletarDoc('lancamentos',id);
}

/* ===== RELATORIO ===== */
let periodoAtual = 'mensal';

function setPeriodo(p) {
  periodoAtual = p;
  document.querySelectorAll('.filtro-tab').forEach(t => t.classList.toggle('active', t.dataset.periodo===p));
  document.getElementById('controles-mensal').style.display  = p==='mensal'  ? 'flex' : 'none';
  document.getElementById('controles-semanal').style.display = p==='semanal' ? 'flex' : 'none';
  renderRelatorio();
}

function semanaAtual() {
  const hoje=new Date(), dow=hoje.getDay(), diffSeg=dow===0?-6:1-dow;
  const seg=new Date(hoje); seg.setDate(hoje.getDate()+diffSeg);
  const dom=new Date(seg); dom.setDate(seg.getDate()+6);
  return { ini:seg.toISOString().substring(0,10), fim:dom.toISOString().substring(0,10) };
}

function populateAnoSelect() {
  const anos=[...new Set(db.lancamentos.map(l=>l.data.substring(0,4)))].sort().reverse();
  const atual=anoAtual(); if (!anos.includes(atual)) anos.unshift(atual);
  const sel=document.getElementById('r-ano'); if (!sel) return;
  const val=sel.value||atual;
  sel.innerHTML=anos.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join('');
  sel.value=val;
}

function renderRelatorio() {
  populateAnoSelect();
  let lancsDoPerido=[], labelPeriodo='';
  if (periodoAtual==='mensal') {
    const mes=document.getElementById('r-mes')?.value||mesAtual(), ano=document.getElementById('r-ano')?.value||anoAtual();
    lancsDoPerido=lancsMes(mes,ano); labelPeriodo=MESES[parseInt(mes)-1]+'/'+ano;
  } else {
    const ini=document.getElementById('r-semana-inicio')?.value, fim=document.getElementById('r-semana-fim')?.value;
    if (!ini||!fim||ini>fim) { document.getElementById('r-metrics').innerHTML='<div style="padding:1rem;color:var(--text-3);font-size:.85rem">Selecione o periodo de inicio e fim.</div>'; document.getElementById('r-barras').innerHTML=''; document.getElementById('tbl-relatorio').innerHTML=''; return; }
    lancsDoPerido=lancsIntervalo(ini,fim); labelPeriodo=formatDate(ini)+' a '+formatDate(fim);
  }
  const totalFat=lancsDoPerido.reduce((s,l)=>s+l.qtd*l.valor,0), totalPecas=lancsDoPerido.reduce((s,l)=>s+l.qtd,0), clientesAt=new Set(lancsDoPerido.map(l=>l.cid)).size;
  document.getElementById('r-metrics').innerHTML=`
    <div class="metric"><div class="lbl">Faturamento</div><div class="val">${esc(fmt(totalFat))}</div></div>
    <div class="metric"><div class="lbl">Pecas lavadas</div><div class="val">${esc(fmtN(totalPecas))}</div></div>
    <div class="metric"><div class="lbl">Clientes ativos</div><div class="val">${esc(String(clientesAt))}</div></div>`;
  const maxPecas=Math.max(...db.clientes.map(c=>pecasDeCliente(c.id,lancsDoPerido)),1);
  let barras='';
  db.clientes.forEach(c=>{ const pm=pecasDeCliente(c.id,lancsDoPerido); if (pm===0) return; const pct=Math.round(pm/maxPecas*100); barras+=`<div class="bar-row"><div class="bar-label">${esc(c.nome)}</div><div class="bar-wrap"><div class="bar-fill" style="width:${esc(String(pct))}%"></div></div><div class="bar-value">${esc(fmtN(pm))}</div></div>`; });
  document.getElementById('r-barras').innerHTML=barras||`<p style="padding:18px 16px;color:var(--text-4);font-size:.82rem">Nenhuma peca em ${esc(labelPeriodo)}</p>`;
  let rows='';
  db.clientes.forEach(c=>{ const fat=fatDeCliente(c.id,lancsDoPerido); if (fat===0) return; const pm=pecasDeCliente(c.id,lancsDoPerido),ab=totalAberto(c.id),abStyle=ab>0?'color:var(--danger);font-weight:700':'color:var(--success);font-weight:700'; rows+=`<tr><td><input type="checkbox" class="chk-rel" data-cid="${esc(c.id)}" onchange="updateBulkActions()"></td><td><div class="client-row"><div class="avatar">${esc(initials(c.nome))}</div>${esc(c.nome)}</div></td><td>${esc(fmtN(pm))}</td><td>${esc(fmt(fat))}</td><td style="${abStyle}">${esc(fmt(ab))}</td><td><button class="btn-quitar" onclick="abrirModal('${esc(c.id)}')">Pgto</button></td></tr>`; });
  document.getElementById('tbl-relatorio').innerHTML=rows||`<tr class="empty-row"><td colspan="6">Nenhuma ficha em ${esc(labelPeriodo)}</td></tr>`;
  document.getElementById('bulk-actions').style.display='none';
  const chkAll=document.getElementById('chk-all'); if (chkAll) chkAll.checked=false;
}

function updateBulkActions() { const chks=document.querySelectorAll('.chk-rel:checked'),bulk=document.getElementById('bulk-actions'); if (chks.length>0){bulk.style.display='flex';document.getElementById('bulk-label').textContent=`${chks.length} cliente(s) selecionado(s)`;}else bulk.style.display='none'; }
function toggleAllChk() { const all=document.getElementById('chk-all').checked; document.querySelectorAll('.chk-rel').forEach(c=>c.checked=all); updateBulkActions(); }
function desmarcarTodos() { document.querySelectorAll('.chk-rel').forEach(c=>c.checked=false); const a=document.getElementById('chk-all'); if(a)a.checked=false; updateBulkActions(); }
async function marcarSelecionadosPago() {
  const chks=document.querySelectorAll('.chk-rel:checked'); if (!chks.length) return;
  if (!confirm(`Marcar como pago: ${Array.from(chks).map(c=>nomeCliente(c.dataset.cid)).join(', ')}?`)) return;
  const batch=writeBatch(db_fire),hoje=hojeISO();
  chks.forEach(chk=>{const cid=chk.dataset.cid,ab=totalAberto(cid);if(ab>0){const id=gerarId();batch.set(doc(db_fire,'pagamentos',id),{id,cid,valor:ab,data:hoje});}});
  await batch.commit(); desmarcarTodos();
}

/* ===== PENDENTES ===== */
function renderPendentes() {
  const pendentes=db.clientes.filter(c=>totalAberto(c.id)>0), totalGeral=pendentes.reduce((s,c)=>s+totalAberto(c.id),0);
  const el=document.getElementById('pendentes-total'); if(el) el.textContent=pendentes.length>0?`${pendentes.length} pendente(s) · ${fmt(totalGeral)}`:'Tudo em dia';
  document.getElementById('pendentes-metrics').innerHTML=`
    <div class="metric"><div class="lbl">Pendentes</div><div class="val danger">${esc(String(pendentes.length))}</div></div>
    <div class="metric"><div class="lbl">Total em aberto</div><div class="val danger">${esc(fmt(totalGeral))}</div></div>
    <div class="metric"><div class="lbl">Total faturado</div><div class="val">${esc(fmt(db.clientes.reduce((s,c)=>s+totalLanc(c.id),0)))}</div></div>
    <div class="metric"><div class="lbl">Total recebido</div><div class="val success">${esc(fmt(db.clientes.reduce((s,c)=>s+totalPago(c.id),0)))}</div></div>`;
  let rows='';
  if (pendentes.length===0) { rows='<tr class="empty-row"><td colspan="5" style="color:var(--success);font-weight:600">Nenhuma pendencia</td></tr>'; }
  else { [...pendentes].sort((a,b)=>totalAberto(b.id)-totalAberto(a.id)).forEach(c=>{ const ab=totalAberto(c.id),ult=db.lancamentos.filter(l=>l.cid===c.id).sort((a,b)=>b.data.localeCompare(a.data))[0]; rows+=`<tr><td><input type="checkbox" class="chk-pend" data-cid="${esc(c.id)}" onchange="updatePendBulk()"></td><td><div class="client-row"><div class="avatar">${esc(initials(c.nome))}</div>${esc(c.nome)}</div></td><td style="color:var(--danger);font-weight:700">${esc(fmt(ab))}</td><td>${ult?esc(formatDate(ult.data)):'-'}</td><td><button class="btn-quitar" onclick="pagarTudo('${esc(c.id)}')">Quitar</button></td></tr>`; }); }
  document.getElementById('tbl-pendentes').innerHTML=rows;
  document.getElementById('pend-bulk-actions').style.display='none';
  const a=document.getElementById('chk-pend-all'); if(a)a.checked=false;
}

async function pagarTudo(cid) { const ab=totalAberto(cid); if(!confirm(`Quitar ${fmt(ab)} de ${nomeCliente(cid)}?`))return; const id=gerarId(); await salvarDoc('pagamentos',id,{id,cid,valor:ab,data:hojeISO()}); }
function updatePendBulk() { const chks=document.querySelectorAll('.chk-pend:checked'),bulk=document.getElementById('pend-bulk-actions'); if(chks.length>0){bulk.style.display='flex';const total=Array.from(chks).reduce((s,c)=>s+totalAberto(c.dataset.cid),0);document.getElementById('pend-bulk-label').textContent=`${chks.length} cliente(s) · ${fmt(total)}`;}else bulk.style.display='none'; }
function toggleAllPendChk() { const all=document.getElementById('chk-pend-all').checked; document.querySelectorAll('.chk-pend').forEach(c=>c.checked=all); updatePendBulk(); }
function desmarcarPendentes() { document.querySelectorAll('.chk-pend').forEach(c=>c.checked=false); const a=document.getElementById('chk-pend-all'); if(a)a.checked=false; updatePendBulk(); }
async function marcarPendentesPago() {
  const chks=document.querySelectorAll('.chk-pend:checked'); if(!chks.length)return;
  const total=Array.from(chks).reduce((s,c)=>s+totalAberto(c.dataset.cid),0);
  if(!confirm(`Quitar ${fmt(total)} de ${chks.length} cliente(s)?`))return;
  const batch=writeBatch(db_fire),hoje=hojeISO();
  chks.forEach(chk=>{const cid=chk.dataset.cid,ab=totalAberto(cid);if(ab>0){const id=gerarId();batch.set(doc(db_fire,'pagamentos',id),{id,cid,valor:ab,data:hoje});}});
  await batch.commit(); desmarcarPendentes();
}

/* ===== SERVICOS ===== */
function renderLavados() {
  let rows='';
  [...db.lavados].sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(lv=>{const usos=db.lancamentos.filter(l=>l.lavado===lv.nome).length; rows+=`<tr><td><strong>${esc(lv.nome)}</strong></td><td>${esc(fmt(lv.valor))}</td><td>${esc(String(usos))} uso${usos!==1?'s':''}</td><td><button class="btn-danger-sm" onclick="deletarLavado('${esc(lv.id)}')" ${usos>0?'disabled title="Servico em uso"':''}>Remover</button></td></tr>`;});
  document.getElementById('tbl-lavados').innerHTML=rows||'<tr class="empty-row"><td colspan="4">Nenhum servico cadastrado</td></tr>';
}

async function salvarLavado() {
  const nome=document.getElementById('lv-nome').value.trim(), valor=parseFloat(document.getElementById('lv-valor').value)||0;
  if (!nome){alert('Digite o nome do servico.');return;}
  if (db.lavados.find(lv=>lv.nome.toLowerCase()===nome.toLowerCase())){alert('Servico ja cadastrado.');return;}
  const id=gerarId(); await salvarDoc('lavados',id,{id,nome,valor});
  document.getElementById('lv-nome').value=''; document.getElementById('lv-valor').value=''; toggleForm('form-lavado');
}

async function deletarLavado(id) { if(!confirm('Remover este servico?'))return; await deletarDoc('lavados',id); }

/* ===== MODAL PAGAMENTO ===== */
let modalCid=null;
function abrirModal(cid) { modalCid=cid; document.getElementById('m-cliente').value=nomeCliente(cid); document.getElementById('m-aberto').value=fmt(totalAberto(cid)); document.getElementById('m-valor').value=''; document.getElementById('modal-bg').style.display='flex'; setTimeout(()=>document.getElementById('m-valor').focus(),350); }
function closeModal() { document.getElementById('modal-bg').style.display='none'; modalCid=null; if(paginaAtual==='cliente-detalhe'&&clienteDetalheId)renderDetalheCliente(clienteDetalheId); }
async function confirmarPagamento() { const val=parseFloat(document.getElementById('m-valor').value); if(!val||val<=0){alert('Valor invalido.');return;} const id=gerarId(); await salvarDoc('pagamentos',id,{id,cid:modalCid,valor:val,data:hojeISO()}); closeModal(); }

/* ===== DETALHE CLIENTE ===== */
let clienteDetalheId=null;
function abrirDetalheCliente(cid) { clienteDetalheId=cid; document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); document.querySelectorAll('[data-page]').forEach(b=>b.classList.remove('active')); document.getElementById('cliente-detalhe').classList.add('active'); paginaAtual='cliente-detalhe'; renderDetalheCliente(cid); }

function renderDetalheCliente(cid) {
  const c=db.clientes.find(x=>x.id==cid); if(!c)return;
  const fichas=[...db.lancamentos.filter(l=>l.cid==cid)].sort((a,b)=>b.id.localeCompare(a.id));
  const pagamentos=[...db.pagamentos.filter(p=>p.cid==cid)].sort((a,b)=>b.data.localeCompare(a.data));
  const totalFat=totalLanc(cid),totalPg=totalPago(cid),ab=totalAberto(cid),totalPcs=fichas.reduce((s,l)=>s+l.qtd,0);
  document.getElementById('detalhe-header').innerHTML=`
    <div style="display:flex;align-items:center;gap:14px;width:100%">
      <div class="detalhe-avatar">${esc(initials(c.nome))}</div>
      <div style="flex:1;min-width:0"><div class="detalhe-nome">${esc(c.nome)}</div><div class="detalhe-tel">${esc(c.tel||'Sem telefone')}</div><div style="font-size:.68rem;color:rgba(255,255,255,.5);margin-top:3px">${esc(String(fichas.length))} ficha${fichas.length!==1?'s':''} &middot; ${esc(fmtN(totalPcs))} pecas</div></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;width:100%">
      <button onclick="imprimirNota()" style="flex:1;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:var(--r);color:#fff;font-size:.82rem;font-weight:600;padding:10px;cursor:pointer;font-family:'DM Sans',sans-serif">Compartilhar nota</button>
      <button onclick="abrirModalDetalhe()" style="flex:1;background:rgba(255,255,255,.22);border:none;border-radius:var(--r);color:#fff;font-size:.82rem;font-weight:700;padding:10px;cursor:pointer;font-family:'DM Sans',sans-serif">Registrar pagamento</button>
    </div>`;
  document.getElementById('detalhe-resumo').innerHTML=`
    <div class="detalhe-stat"><div class="lbl">Faturado</div><div class="val">${esc(fmt(totalFat))}</div></div>
    <div class="detalhe-stat"><div class="lbl">Pago</div><div class="val success">${esc(fmt(totalPg))}</div></div>
    <div class="detalhe-stat"><div class="lbl">Em aberto</div><div class="val ${ab>0?'danger':''}">${esc(fmt(ab))}</div></div>`;
  let htmlAbertas = ab<=0 ? '<div class="empty-detalhe" style="color:var(--success)">Tudo pago</div>'
    : fichas.map(l=>`<div class="ficha-aberta-card"><div class="ficha-aberta-top"><span class="ficha-aberta-peca">${esc(l.peca)}</span><span class="ficha-aberta-valor">${esc(fmt(l.qtd*l.valor))}</span></div><div class="ficha-aberta-meta">${esc(fmtN(l.qtd))} pecas &middot; ${esc(l.lavado)} &middot; ${esc(formatDate(l.data))}</div></div>`).join('')
      + `<div style="margin-top:10px"><button class="btn-primary" style="width:100%;padding:13px" onclick="abrirModalDetalhe()">Registrar pagamento &mdash; ${esc(fmt(ab))}</button></div>`;
  document.getElementById('detalhe-fichas-abertas').innerHTML=htmlAbertas;
  document.getElementById('detalhe-pagamentos').innerHTML=pagamentos.length===0
    ? '<div class="empty-detalhe">Nenhum pagamento registrado</div>'
    : pagamentos.map(p=>`<div class="pgto-card"><div><div class="pgto-card-info">Pagamento registrado</div><div class="pgto-card-data">${esc(formatDate(p.data))}</div></div><div class="pgto-card-valor">+ ${esc(fmt(p.valor))}</div></div>`).join('');
  document.getElementById('detalhe-todas-fichas').innerHTML=fichas.length===0
    ? '<div class="empty-detalhe">Nenhuma ficha ainda</div>'
    : fichas.map(l=>`<div class="lanc-card"><div class="lanc-card-left"><div class="lanc-card-peca">${esc(l.peca)}</div><div class="lanc-card-meta">${esc(fmtN(l.qtd))} pecas</div><span class="lanc-tipo-chip">${esc(l.lavado)}</span></div><div class="lanc-card-right"><div class="lanc-card-total">${esc(fmt(l.qtd*l.valor))}</div><div class="lanc-card-date">${esc(formatDate(l.data))}</div><div style="display:flex;gap:5px;margin-top:6px;justify-content:flex-end"><button class="btn-edit-sm" onclick="editarFicha('${esc(l.id)}')">Editar</button><button class="btn-danger-sm" onclick="deletarLanc('${esc(l.id)}')">Remover</button></div></div></div>`).join('');
}

function abrirModalDetalhe() { if(clienteDetalheId)abrirModal(clienteDetalheId); }

/* ===== EDITAR FICHA ===== */
let editFichaId=null;
function editarFicha(id) { const l=db.lancamentos.find(x=>x.id==id); if(!l)return; editFichaId=id; document.getElementById('e-peca').value=l.peca; document.getElementById('e-data').value=l.data; document.getElementById('e-qtd').value=l.qtd; document.getElementById('e-valor').value=l.valor; populateLavadoSelects(); document.getElementById('e-lavado').value=l.lavado; updateEditPreview(); document.getElementById('modal-edit-bg').style.display='flex'; }
function updateEditPreview() { const qtd=parseInt(document.getElementById('e-qtd').value)||0,valor=parseFloat(document.getElementById('e-valor').value)||0; document.getElementById('e-preview').textContent=qtd*valor>0?`Total: ${fmt(qtd*valor)}`:''; }
function closeEditModal() { document.getElementById('modal-edit-bg').style.display='none'; editFichaId=null; }
async function salvarEdicaoFicha() { const peca=document.getElementById('e-peca').value.trim(),lavado=document.getElementById('e-lavado').value,data=document.getElementById('e-data').value,qtd=parseInt(document.getElementById('e-qtd').value),valor=parseFloat(document.getElementById('e-valor').value); if(!peca||!data||!qtd||!valor){alert('Preencha todos os campos.');return;} const orig=db.lancamentos.find(x=>x.id==editFichaId); await salvarDoc('lancamentos',editFichaId,{...orig,peca,lavado,data,qtd,valor}); closeEditModal(); }

/* ===== NOTA ===== */
function imprimirNota() {
  const cid=clienteDetalheId; if(!cid)return;
  const c=db.clientes.find(x=>x.id==cid); if(!c)return;
  const fichas=[...db.lancamentos.filter(l=>l.cid==cid)].sort((a,b)=>a.id.localeCompare(b.id));
  const totalFat=totalLanc(cid),hoje=new Date().toLocaleDateString('pt-BR');
  const base=window.location.pathname.replace(/\/[^/]*$/,''),logoUrl=window.location.origin+base+'/img/logo-nova-lavanderia.png';
  const linhasTabela=fichas.map(l=>`<tr><td>${esc(String(l.qtd))} ${esc(l.peca)}</td><td>${esc(l.lavado)}</td><td>R$ ${esc(l.valor.toFixed(2).replace('.',','))}</td><td>R$ ${esc((l.qtd*l.valor).toFixed(2).replace('.',','))}</td><td>${esc(formatDate(l.data))}</td></tr>`).join('');
  const html=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nota - ${esc(c.nome)}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11pt;color:#000;padding:14mm 16mm}.logo-wrap{text-align:center;margin-bottom:18px}.logo-wrap img{height:64px;width:auto}.info{margin-bottom:16px;line-height:1.9;font-size:10.5pt}.info strong{font-weight:bold}table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:10pt}th{background:#e3f0ff;border:1px solid #b3d4ff;padding:8px;text-align:left;font-weight:bold;color:#1255a8}td{border:1px solid #dde6f0;padding:7px 8px;vertical-align:top}tr:nth-child(even) td{background:#f7f9fc}.total-wrap{text-align:right;margin-top:8px}.total-line{display:inline-flex;gap:24px;border-top:2px solid #1565c0;padding-top:8px;font-size:12pt;font-weight:bold;color:#1565c0}.assin{margin-top:40px;font-size:10pt;color:#555}.btn-comp{display:block;width:100%;margin-top:24px;padding:14px;background:#1565c0;color:#fff;border:none;border-radius:8px;font-size:14pt;font-weight:700;cursor:pointer;font-family:Arial,sans-serif}@media print{.btn-comp{display:none}body{padding:12mm 15mm}}</style></head><body><div class="logo-wrap"><img src="${logoUrl}" onerror="this.style.display='none'"></div><div class="info"><div><strong>Contato:</strong> (83) 981267379 / (83) 981053327</div><div><strong>Cliente:</strong> ${esc(c.nome)}</div><div><strong>Data:</strong> ${esc(hoje)}</div></div><table><thead><tr><th>Quantidade</th><th>Servico</th><th>Valor unit.</th><th>Total</th><th>Data</th></tr></thead><tbody>${linhasTabela}</tbody></table><div class="total-wrap"><div class="total-line"><span>TOTAL:</span><span>R$ ${esc(totalFat.toLocaleString('pt-BR',{minimumFractionDigits:2}))}</span></div></div><div class="assin">Assinatura do cliente: _______________________________</div><button class="btn-comp" onclick="window.print()">Salvar / Compartilhar PDF</button></body></html>`;
  const blob=new Blob([html],{type:'text/html'}); window.location.href=URL.createObjectURL(blob);
}

/* ===== EXPOR GLOBALS ===== */
window.showPage=showPage; window.toggleForm=toggleForm; window.salvarCliente=salvarCliente; window.deletarCliente=deletarCliente;
window.salvarLancamento=salvarLancamento; window.deletarLanc=deletarLanc; window.updatePreview=updatePreview; window.renderLancamentos=renderLancamentos;
window.salvarLavado=salvarLavado; window.deletarLavado=deletarLavado; window.renderRelatorio=renderRelatorio; window.renderPendentes=renderPendentes;
window.abrirModal=abrirModal; window.closeModal=closeModal; window.confirmarPagamento=confirmarPagamento; window.pagarTudo=pagarTudo;
window.toggleAllChk=toggleAllChk; window.desmarcarTodos=desmarcarTodos; window.marcarSelecionadosPago=marcarSelecionadosPago; window.updateBulkActions=updateBulkActions;
window.toggleAllPendChk=toggleAllPendChk; window.desmarcarPendentes=desmarcarPendentes; window.marcarPendentesPago=marcarPendentesPago; window.updatePendBulk=updatePendBulk;
window.abrirDetalheCliente=abrirDetalheCliente; window.abrirModalDetalhe=abrirModalDetalhe;
window.editarFicha=editarFicha; window.closeEditModal=closeEditModal; window.salvarEdicaoFicha=salvarEdicaoFicha; window.updateEditPreview=updateEditPreview;
window.imprimirNota=imprimirNota; window.setPeriodo=setPeriodo;
window.fazerLogin=fazerLogin; window.fazerLogout=fazerLogout; window.toggleSenha=toggleSenha;
window.salvarFichaFunc=salvarFichaFunc;

/* ===== BOOT ===== */
showLoading('Conectando...');