/* ===== FIREBASE ===== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, writeBatch }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

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

let db = { clientes: [], lancamentos: [], pagamentos: [], lavados: [] };
let appReady = false;
let paginaAtual = 'dashboard';

const LAVADOS_INICIAIS = [
  { id:'lv1', nome:'Marmorizado',     valor:3.50 },
  { id:'lv2', nome:'Destroyed',       valor:3.00 },
  { id:'lv3', nome:'Hiper Destroyed', valor:3.30 },
  { id:'lv4', nome:'Amaciado',        valor:1.50 },
  { id:'lv5', nome:'Engomado',        valor:2.00 },
];

function showLoading(msg='Carregando...') {
  document.getElementById('loading-overlay').style.display='flex';
  document.getElementById('loading-msg').textContent=msg;
}
function hideLoading() { document.getElementById('loading-overlay').style.display='none'; }

async function migrarDadosIniciais() {
  const snap = await getDocs(collection(db_fire,'lavados'));
  if (!snap.empty) return;
  showLoading('Configurando...');
  const batch = writeBatch(db_fire);
  LAVADOS_INICIAIS.forEach(lv => batch.set(doc(db_fire,'lavados',lv.id),lv));
  await batch.commit();
}

function iniciarListeners() {
  let counts={clientes:false,lancamentos:false,pagamentos:false,lavados:false};
  function check(){
    if(Object.values(counts).every(Boolean)&&!appReady){appReady=true;hideLoading();inicializarApp();}
  }
  onSnapshot(collection(db_fire,'clientes'),snap=>{db.clientes=snap.docs.map(d=>({...d.data(),id:d.id}));counts.clientes=true;check();if(appReady)refreshCurrentPage();});
  onSnapshot(collection(db_fire,'lancamentos'),snap=>{db.lancamentos=snap.docs.map(d=>({...d.data(),id:d.id}));counts.lancamentos=true;check();if(appReady)refreshCurrentPage();});
  onSnapshot(collection(db_fire,'pagamentos'),snap=>{db.pagamentos=snap.docs.map(d=>({...d.data(),id:d.id}));counts.pagamentos=true;check();if(appReady)refreshCurrentPage();});
  onSnapshot(collection(db_fire,'lavados'),snap=>{db.lavados=snap.docs.map(d=>({...d.data(),id:d.id}));counts.lavados=true;check();if(appReady){populateLavadoSelect();refreshCurrentPage();}});
}

function gerarId(){return Date.now().toString(36)+Math.random().toString(36).substring(2,6);}
async function salvarDoc(col,id,dados){await setDoc(doc(db_fire,col,id),dados);}
async function deletarDoc(col,id){await deleteDoc(doc(db_fire,col,id));}

const MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function fmt(v){return 'R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtN(v){return Number(v).toLocaleString('pt-BR');}
function mesAtual(){return String(new Date().getMonth()+1).padStart(2,'0');}
function nomeCliente(id){const c=db.clientes.find(x=>x.id==id);return c?c.nome:'?';}
function initials(nome){return nome.split(' ').map(x=>x[0]).join('').substring(0,2).toUpperCase();}
function totalLanc(cid){return db.lancamentos.filter(l=>l.cid==cid).reduce((s,l)=>s+l.qtd*l.valor,0);}
function totalPago(cid){return db.pagamentos.filter(p=>p.cid==cid).reduce((s,p)=>s+p.valor,0);}
function totalAberto(cid){return Math.max(0,totalLanc(cid)-totalPago(cid));}
function pecasMes(cid,mes){return db.lancamentos.filter(l=>l.cid==cid&&l.data.substring(5,7)===mes).reduce((s,l)=>s+l.qtd,0);}
function fatMes(cid,mes){return db.lancamentos.filter(l=>l.cid==cid&&l.data.substring(5,7)===mes).reduce((s,l)=>s+l.qtd*l.valor,0);}
function formatDate(iso){return iso.split('-').reverse().join('/');}

function showPage(id){
  paginaAtual=id;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll(`.nav-item[data-page="${id}"]`).forEach(b=>b.classList.add('active'));
  ({dashboard:renderDashboard,clientes:renderClientes,lancamentos:renderLancamentos,relatorio:renderRelatorio,pendentes:renderPendentes,lavados:renderLavados})[id]?.();
}
function refreshCurrentPage(){
  ({dashboard:renderDashboard,clientes:renderClientes,lancamentos:renderLancamentos,relatorio:renderRelatorio,pendentes:renderPendentes,lavados:renderLavados,'cliente-detalhe':()=>{}})[paginaAtual]?.();
}

function toggleForm(id, preSelectCid){
  const el=document.getElementById(id);
  el.style.display=el.style.display==='none'?'block':'none';
  if(el.style.display==='block'){
    populateSelects();
    populateLavadoSelect();
    if(preSelectCid){
      const sel=document.getElementById('l-cliente');
      if(sel) sel.value=preSelectCid;
    }
    // Scroll to form
    setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),100);
  }
}
function populateSelects(){
  ['l-cliente','f-cliente'].forEach(sid=>{
    const sel=document.getElementById(sid);if(!sel)return;
    const val=sel.value;
    sel.innerHTML=sid==='f-cliente'?'<option value="">Todos clientes</option>':'<option value="">Selecione...</option>';
    db.clientes.sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.nome;sel.appendChild(o);});
    if(val)sel.value=val;
  });
}
function populateLavadoSelect(){
  const sel=document.getElementById('l-lavado');if(!sel)return;
  const val=sel.value;sel.innerHTML='';
  db.lavados.sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(lv=>{const o=document.createElement('option');o.value=lv.nome;o.textContent=lv.nome;sel.appendChild(o);});
  if(val)sel.value=val;
}

function renderDashboard(){
  const hoje=new Date();
  const el=document.getElementById('dash-date');
  if(el)el.textContent=hoje.toLocaleDateString('pt-BR',{weekday:'short',day:'numeric',month:'short'});
  const totalFat=db.lancamentos.reduce((s,l)=>s+l.qtd*l.valor,0);
  const totalAb=db.clientes.reduce((s,c)=>s+totalAberto(c.id),0);
  const totalPcs=db.lancamentos.reduce((s,l)=>s+l.qtd,0);
  const mes=mesAtual();
  const fatMesAt=db.lancamentos.filter(l=>l.data.substring(5,7)===mes).reduce((s,l)=>s+l.qtd*l.valor,0);
  document.getElementById('metrics-cards').innerHTML=`
    <div class="metric"><div class="lbl">Faturamento total</div><div class="val">${fmt(totalFat)}</div></div>
    <div class="metric"><div class="lbl">Em aberto</div><div class="val">${fmt(totalAb)}</div></div>
    <div class="metric"><div class="lbl">Total peças</div><div class="val">${fmtN(totalPcs)}</div></div>
    <div class="metric"><div class="lbl">${MESES[parseInt(mes)-1]}</div><div class="val">${fmt(fatMesAt)}</div></div>`;
  let rowsAberto='';
  db.clientes.sort((a,b)=>totalAberto(b.id)-totalAberto(a.id)).forEach(c=>{
    const tot=totalLanc(c.id);if(tot===0)return;
    const ab=totalAberto(c.id);
    const badge=ab===0?'<span class="badge badge-green">Pago</span>':ab<500?'<span class="badge badge-amber">Parcial</span>':'<span class="badge badge-red">Aberto</span>';
    rowsAberto+=`<tr><td><div class="client-row"><div class="avatar">${initials(c.nome)}</div>${c.nome}</div></td><td>${fmt(tot)}</td><td>${fmt(ab)}</td><td>${badge}</td></tr>`;
  });
  document.getElementById('tbl-aberto').innerHTML=rowsAberto||'<tr class="empty-row"><td colspan="4">Sem fichas ainda</td></tr>';
  let rowsUlt='';
  [...db.lancamentos].sort((a,b)=>b.id.localeCompare(a.id)).slice(0,6).forEach(l=>{
    rowsUlt+=`<tr><td>${formatDate(l.data)}</td><td>${nomeCliente(l.cid)}</td><td>${l.peca}</td><td>${fmtN(l.qtd)}</td><td>${fmt(l.qtd*l.valor)}</td></tr>`;
  });
  document.getElementById('tbl-ultimos').innerHTML=rowsUlt||'<tr class="empty-row"><td colspan="5">Nenhum ficha</td></tr>';
}

function renderClientes(){
  populateSelects();
  const mes=mesAtual();
  const list=document.getElementById('client-list');
  if(db.clientes.length===0){list.innerHTML='<div style="text-align:center;padding:2.5rem;color:var(--text-4);font-size:0.85rem">Nenhum cliente cadastrado</div>';return;}
  list.innerHTML=db.clientes.sort((a,b)=>a.nome.localeCompare(b.nome)).map(c=>{
    const pm=pecasMes(c.id,mes),tot=totalLanc(c.id),ab=totalAberto(c.id);
    return `<div class="client-card" onclick="abrirDetalheCliente('${c.id}')" style="cursor:pointer">
      <div class="avatar" style="width:40px;height:40px;font-size:13px;flex-shrink:0">${initials(c.nome)}</div>
      <div class="client-card-info">
        <div class="client-card-name">${c.nome}</div>
        <div class="client-card-stats">
          <span class="client-card-stat">${c.tel||'Sem tel'}</span>
          <span class="client-card-stat">Mês: <span>${fmtN(pm)} pç</span></span>
        </div>
        <div style="font-size:0.72rem;color:var(--text-3);margin-top:2px">Total: <strong style="color:var(--blue-700)">${fmt(tot)}</strong></div>
      </div>
      <div class="client-card-actions">
        <span class="client-ab ${ab===0?'zero':''}">${ab===0?'✓ Pago':fmt(ab)}</span>
        <button class="btn-quitar" onclick="abrirModal('${c.id}')">+ Pgto</button>
        <button class="btn-danger-sm" onclick="deletarCliente('${c.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

async function salvarCliente(){
  const nome=document.getElementById('c-nome').value.trim();
  const tel=document.getElementById('c-tel').value.trim();
  if(!nome){alert('Digite o nome!');return;}
  const id=gerarId();
  await salvarDoc('clientes',id,{id,nome,tel});
  document.getElementById('c-nome').value='';document.getElementById('c-tel').value='';
  toggleForm('form-cliente');
}
async function deletarCliente(id){
  if(!confirm(`Remover "${nomeCliente(id)}" e todos os dados?`))return;
  const batch=writeBatch(db_fire);
  batch.delete(doc(db_fire,'clientes',id));
  db.lancamentos.filter(l=>l.cid==id).forEach(l=>batch.delete(doc(db_fire,'lancamentos',l.id)));
  db.pagamentos.filter(p=>p.cid==id).forEach(p=>batch.delete(doc(db_fire,'pagamentos',p.id)));
  await batch.commit();
}

function renderLancamentos(){
  populateSelects();
  const fcid=document.getElementById('f-cliente').value;
  const fmes=document.getElementById('f-mes').value;
  let lancs=[...db.lancamentos].sort((a,b)=>b.id.localeCompare(a.id));
  if(fcid)lancs=lancs.filter(l=>l.cid==fcid);
  if(fmes)lancs=lancs.filter(l=>l.data.substring(5,7)===fmes);
  const container=document.getElementById('lanc-list');
  if(lancs.length===0){container.innerHTML='<div style="text-align:center;padding:2.5rem;color:var(--text-4);font-size:0.85rem">Nenhum ficha</div>';return;}
  const total=lancs.reduce((s,l)=>s+l.qtd*l.valor,0);
  const pecas=lancs.reduce((s,l)=>s+l.qtd,0);
  container.innerHTML=lancs.map(l=>`
    <div class="lanc-card">
      <div class="lanc-card-left">
        <div class="lanc-card-peca">${l.peca}</div>
        <div class="lanc-card-meta">${nomeCliente(l.cid)} · ${fmtN(l.qtd)} peças</div>
        <span class="lanc-tipo-chip">${l.lavado}</span>
      </div>
      <div class="lanc-card-right">
        <div class="lanc-card-total">${fmt(l.qtd*l.valor)}</div>
        <div class="lanc-card-date">${formatDate(l.data)}</div>
        <div style="display:flex;gap:5px;margin-top:5px">
          <button class="btn-edit-sm" onclick="editarFicha('${l.id}')">✏️</button>
          <button class="btn-danger-sm" onclick="deletarLanc('${l.id}')">✕</button>
        </div>
      </div>
    </div>`).join('')+
    `<div class="card" style="padding:12px 14px;display:flex;justify-content:space-between;align-items:center;margin-top:6px">
      <span style="font-size:0.75rem;color:var(--text-3);font-weight:600">${fmtN(pecas)} peças · ${lancs.length} itens</span>
      <span style="font-size:0.88rem;font-weight:700;color:var(--blue-800)">${fmt(total)}</span>
    </div>`;
}

function updatePreview(){
  const qtd=parseInt(document.getElementById('l-qtd').value)||0;
  const val=parseFloat(document.getElementById('l-valor').value)||0;
  document.getElementById('l-preview').textContent=qtd*val>0?`Total: ${fmt(qtd*val)}`:'';
}
async function salvarLancamento(){
  const cid=document.getElementById('l-cliente').value;
  const data=document.getElementById('l-data').value;
  const peca=document.getElementById('l-peca').value.trim();
  const lavado=document.getElementById('l-lavado').value;
  const qtd=parseInt(document.getElementById('l-qtd').value);
  const valor=parseFloat(document.getElementById('l-valor').value);
  if(!cid||!data||!peca||!qtd||!valor){alert('Preencha todos os campos!');return;}
  const id=gerarId();
  await salvarDoc('lancamentos',id,{id,cid,data,peca,lavado,qtd,valor});
  document.getElementById('l-peca').value='';document.getElementById('l-qtd').value='';
  document.getElementById('l-valor').value='';document.getElementById('l-preview').textContent='';
  toggleForm('form-lanc');
  // Se veio de um cliente específico, volta para o detalhe dele
  const cidSel = document.getElementById('l-cliente').value;
  if (cidSel && paginaAtual === 'lancamentos') {
    // Stay on lancamentos
  }
}
async function deletarLanc(id){if(!confirm('Remover?'))return;await deletarDoc('lancamentos',id);}

function renderRelatorio(){
  const mes=document.getElementById('r-mes').value;
  const lancs=db.lancamentos.filter(l=>l.data.substring(5,7)===mes);
  const totalFat=lancs.reduce((s,l)=>s+l.qtd*l.valor,0);
  const totalPecas=lancs.reduce((s,l)=>s+l.qtd,0);
  const clientesAt=new Set(lancs.map(l=>l.cid)).size;
  document.getElementById('r-metrics').innerHTML=`
    <div class="metric"><div class="lbl">Faturamento</div><div class="val">${fmt(totalFat)}</div></div>
    <div class="metric"><div class="lbl">Peças lavadas</div><div class="val">${fmtN(totalPecas)}</div></div>
    <div class="metric"><div class="lbl">Clientes ativos</div><div class="val">${clientesAt}</div></div>`;
  const maxPecas=Math.max(...db.clientes.map(c=>pecasMes(c.id,mes)),1);
  let barras='';
  db.clientes.forEach(c=>{
    const pm=pecasMes(c.id,mes);if(pm===0)return;
    const pct=Math.round((pm/maxPecas)*100);
    barras+=`<div class="bar-row"><div class="bar-label">${c.nome}</div><div class="bar-wrap"><div class="bar-fill" style="width:${pct}%"></div></div><div class="bar-value">${fmtN(pm)}</div></div>`;
  });
  document.getElementById('r-barras').innerHTML=barras||'<p style="padding:16px;color:var(--text-4);font-size:0.82rem">Nenhuma peça neste mês</p>';
  let rows='';
  db.clientes.forEach(c=>{
    const fat=fatMes(c.id,mes);if(fat===0)return;
    const pm=pecasMes(c.id,mes),pago=totalPago(c.id),ab=totalAberto(c.id);
    const abStyle=ab>0?'color:var(--danger);font-weight:700':'color:var(--success);font-weight:700';
    rows+=`<tr>
      <td><input type="checkbox" class="chk-rel" data-cid="${c.id}" onchange="updateBulkActions()"></td>
      <td><div class="client-row"><div class="avatar">${initials(c.nome)}</div>${c.nome}</div></td>
      <td>${fmtN(pm)}</td><td>${fmt(fat)}</td>
      <td style="${abStyle}">${fmt(ab)}</td>
      <td><button class="btn-quitar" onclick="abrirModal('${c.id}')">Pgto</button></td>
    </tr>`;
  });
  document.getElementById('tbl-relatorio').innerHTML=rows||'<tr class="empty-row"><td colspan="6">Nenhum ficha</td></tr>';
  document.getElementById('bulk-actions').style.display='none';
  const chkAll=document.getElementById('chk-all');if(chkAll)chkAll.checked=false;
}
function updateBulkActions(){
  const chks=document.querySelectorAll('.chk-rel:checked');
  const bulk=document.getElementById('bulk-actions');
  if(chks.length>0){bulk.style.display='flex';document.getElementById('bulk-label').textContent=`${chks.length} cliente(s) selecionado(s)`;}
  else bulk.style.display='none';
}
function toggleAllChk(){const all=document.getElementById('chk-all').checked;document.querySelectorAll('.chk-rel').forEach(c=>c.checked=all);updateBulkActions();}
function desmarcarTodos(){document.querySelectorAll('.chk-rel').forEach(c=>c.checked=false);const a=document.getElementById('chk-all');if(a)a.checked=false;updateBulkActions();}
async function marcarSelecionadosPago(){
  const chks=document.querySelectorAll('.chk-rel:checked');if(!chks.length)return;
  const nomes=Array.from(chks).map(c=>nomeCliente(c.dataset.cid)).join(', ');
  if(!confirm(`Marcar como pago: ${nomes}?`))return;
  const batch=writeBatch(db_fire);const hoje=new Date().toISOString().substring(0,10);
  chks.forEach(chk=>{const cid=chk.dataset.cid;const ab=totalAberto(cid);if(ab>0){const id=gerarId();batch.set(doc(db_fire,'pagamentos',id),{id,cid,valor:ab,data:hoje});}});
  await batch.commit();desmarcarTodos();
}

function renderPendentes(){
  const pendentes=db.clientes.filter(c=>totalAberto(c.id)>0);
  const totalGeral=pendentes.reduce((s,c)=>s+totalAberto(c.id),0);
  const el=document.getElementById('pendentes-total');
  if(el)el.textContent=pendentes.length>0?`${pendentes.length} · ${fmt(totalGeral)}`:'✓ Tudo pago';
  document.getElementById('pendentes-metrics').innerHTML=`
    <div class="metric"><div class="lbl">Pendentes</div><div class="val">${pendentes.length}</div></div>
    <div class="metric"><div class="lbl">Total aberto</div><div class="val" style="color:var(--danger)">${fmt(totalGeral)}</div></div>
    <div class="metric"><div class="lbl">Total faturado</div><div class="val">${fmt(db.clientes.reduce((s,c)=>s+totalLanc(c.id),0))}</div></div>
    <div class="metric"><div class="lbl">Total recebido</div><div class="val" style="color:var(--success)">${fmt(db.clientes.reduce((s,c)=>s+totalPago(c.id),0))}</div></div>`;
  let rows='';
  if(pendentes.length===0){rows='<tr class="empty-row"><td colspan="5" style="color:var(--success);font-weight:700">✓ Nenhuma pendência!</td></tr>';}
  else{
    pendentes.sort((a,b)=>totalAberto(b.id)-totalAberto(a.id)).forEach(c=>{
      const ab=totalAberto(c.id);
      const ult=db.lancamentos.filter(l=>l.cid===c.id).sort((a,b)=>b.data.localeCompare(a.data))[0];
      rows+=`<tr>
        <td><input type="checkbox" class="chk-pend" data-cid="${c.id}" onchange="updatePendBulk()"></td>
        <td><div class="client-row"><div class="avatar">${initials(c.nome)}</div>${c.nome}</div></td>
        <td style="color:var(--danger);font-weight:700">${fmt(ab)}</td>
        <td>${ult?formatDate(ult.data):'-'}</td>
        <td><button class="btn-quitar" onclick="pagarTudo('${c.id}')">Quitar</button></td>
      </tr>`;
    });
  }
  document.getElementById('tbl-pendentes').innerHTML=rows;
  document.getElementById('pend-bulk-actions').style.display='none';
  const a=document.getElementById('chk-pend-all');if(a)a.checked=false;
}
async function pagarTudo(cid){
  const ab=totalAberto(cid);if(!confirm(`Quitar ${fmt(ab)} de ${nomeCliente(cid)}?`))return;
  const id=gerarId();await salvarDoc('pagamentos',id,{id,cid,valor:ab,data:new Date().toISOString().substring(0,10)});
}
function updatePendBulk(){
  const chks=document.querySelectorAll('.chk-pend:checked');
  const bulk=document.getElementById('pend-bulk-actions');
  if(chks.length>0){bulk.style.display='flex';const total=Array.from(chks).reduce((s,c)=>s+totalAberto(c.dataset.cid),0);document.getElementById('pend-bulk-label').textContent=`${chks.length} · ${fmt(total)}`;}
  else bulk.style.display='none';
}
function toggleAllPendChk(){const all=document.getElementById('chk-pend-all').checked;document.querySelectorAll('.chk-pend').forEach(c=>c.checked=all);updatePendBulk();}
function desmarcarPendentes(){document.querySelectorAll('.chk-pend').forEach(c=>c.checked=false);const a=document.getElementById('chk-pend-all');if(a)a.checked=false;updatePendBulk();}
async function marcarPendentesPago(){
  const chks=document.querySelectorAll('.chk-pend:checked');if(!chks.length)return;
  const total=Array.from(chks).reduce((s,c)=>s+totalAberto(c.dataset.cid),0);
  if(!confirm(`Quitar ${fmt(total)} de ${chks.length} cliente(s)?`))return;
  const batch=writeBatch(db_fire);const hoje=new Date().toISOString().substring(0,10);
  chks.forEach(chk=>{const cid=chk.dataset.cid;const ab=totalAberto(cid);if(ab>0){const id=gerarId();batch.set(doc(db_fire,'pagamentos',id),{id,cid,valor:ab,data:hoje});}});
  await batch.commit();desmarcarPendentes();
}

function renderLavados(){
  let rows='';
  db.lavados.sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(lv=>{
    const usos=db.lancamentos.filter(l=>l.lavado===lv.nome).length;
    rows+=`<tr><td><strong>${lv.nome}</strong></td><td>${fmt(lv.valor)}</td><td>${usos}x</td><td><button class="btn-danger-sm" onclick="deletarLavado('${lv.id}')" ${usos>0?'disabled':''}>✕</button></td></tr>`;
  });
  document.getElementById('tbl-lavados').innerHTML=rows||'<tr class="empty-row"><td colspan="4">Nenhum lavado</td></tr>';
}
async function salvarLavado(){
  const nome=document.getElementById('lv-nome').value.trim();
  const valor=parseFloat(document.getElementById('lv-valor').value)||0;
  if(!nome){alert('Digite o nome!');return;}
  if(db.lavados.find(lv=>lv.nome.toLowerCase()===nome.toLowerCase())){alert('Já existe!');return;}
  const id=gerarId();await salvarDoc('lavados',id,{id,nome,valor});
  document.getElementById('lv-nome').value='';document.getElementById('lv-valor').value='';
  toggleForm('form-lavado');
}
async function deletarLavado(id){if(!confirm('Remover?'))return;await deletarDoc('lavados',id);}

let modalCid=null;
function abrirModal(cid){
  modalCid=cid;
  document.getElementById('m-cliente').value=nomeCliente(cid);
  document.getElementById('m-aberto').value=fmt(totalAberto(cid));
  document.getElementById('m-valor').value='';
  document.getElementById('modal-bg').style.display='flex';
}
function closeModal(){document.getElementById('modal-bg').style.display='none';modalCid=null;}
async function confirmarPagamento(){
  const val=parseFloat(document.getElementById('m-valor').value);
  if(!val||val<=0){alert('Valor inválido!');return;}
  const id=gerarId();
  await salvarDoc('pagamentos',id,{id,cid:modalCid,valor:val,data:new Date().toISOString().substring(0,10)});
  closeModal();
}

function inicializarApp(){
  const mes=mesAtual();
  const rMes=document.getElementById('r-mes');if(rMes)rMes.value=mes;
  const lData=document.getElementById('l-data');if(lData)lData.value=new Date().toISOString().split('T')[0];
  populateLavadoSelect();populateSelects();renderDashboard();
  // Show sidebar on desktop
  const sidebar=document.getElementById('sidebar');
  if(sidebar && window.innerWidth>=768) sidebar.style.display='flex';
  window.addEventListener('resize',()=>{
    if(sidebar) sidebar.style.display=window.innerWidth>=768?'flex':'none';
  });
}

window.showPage=showPage;window.toggleForm=toggleForm;window.salvarCliente=salvarCliente;
window.deletarCliente=deletarCliente;window.salvarLancamento=salvarLancamento;
window.deletarLanc=deletarLanc;window.updatePreview=updatePreview;
window.renderLancamentos=renderLancamentos;window.salvarLavado=salvarLavado;
window.deletarLavado=deletarLavado;window.renderRelatorio=renderRelatorio;
window.renderPendentes=renderPendentes;window.abrirModal=abrirModal;
window.closeModal=closeModal;window.confirmarPagamento=confirmarPagamento;
window.pagarTudo=pagarTudo;window.toggleAllChk=toggleAllChk;
window.desmarcarTodos=desmarcarTodos;window.marcarSelecionadosPago=marcarSelecionadosPago;
window.updateBulkActions=updateBulkActions;window.toggleAllPendChk=toggleAllPendChk;
window.desmarcarPendentes=desmarcarPendentes;window.marcarPendentesPago=marcarPendentesPago;
window.updatePendBulk=updatePendBulk;

showLoading('Conectando...');
migrarDadosIniciais().then(()=>iniciarListeners());

/* ===== CLIENTE DETALHE ===== */
let clienteDetalheId = null;

function abrirDetalheCliente(cid) {
  clienteDetalheId = cid;
  renderDetalheCliente(cid);
  // Navigate to detail page without nav highlight
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('cliente-detalhe').classList.add('active');
  paginaAtual = 'cliente-detalhe';
}

function renderDetalheCliente(cid) {
  const c = db.clientes.find(x => x.id == cid);
  if (!c) return;

  const fichas = db.lancamentos.filter(l => l.cid == cid).sort((a,b) => b.id.localeCompare(a.id));
  const pagamentos = db.pagamentos.filter(p => p.cid == cid).sort((a,b) => b.data.localeCompare(a.data));
  const totalFat = totalLanc(cid);
  const totalPg  = totalPago(cid);
  const ab       = totalAberto(cid);
  const totalPcs = fichas.reduce((s,l) => s+l.qtd, 0);

  // Header
  document.getElementById('detalhe-header').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;width:100%">
      <div class="detalhe-avatar">${initials(c.nome)}</div>
      <div style="flex:1;min-width:0">
        <div class="detalhe-nome">${c.nome}</div>
        <div class="detalhe-tel">${c.tel || 'Sem telefone'}</div>
        <div style="font-size:0.7rem;color:rgba(255,255,255,0.6);margin-top:2px">${fichas.length} ficha${fichas.length!==1?'s':''} · ${fmtN(totalPcs)} peças</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px;width:100%">
      <button onclick="imprimirNota()" style="flex:1;background:rgba(255,255,255,0.15);border:1.5px solid rgba(255,255,255,0.35);border-radius:10px;color:#fff;font-size:0.85rem;font-weight:700;padding:10px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">📤 Compartilhar Nota</button>
      <button onclick="abrirModalDetalhe()" style="flex:1;background:rgba(255,255,255,0.15);border:1.5px solid rgba(255,255,255,0.35);border-radius:10px;color:#fff;font-size:0.85rem;font-weight:700;padding:10px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif">+ Registrar Pgto</button>
    </div>`;

  // Resumo
  document.getElementById('detalhe-resumo').innerHTML = `
    <div class="detalhe-stat">
      <div class="lbl">Faturado</div>
      <div class="val">${fmt(totalFat)}</div>
    </div>
    <div class="detalhe-stat">
      <div class="lbl">Pago</div>
      <div class="val success">${fmt(totalPg)}</div>
    </div>
    <div class="detalhe-stat">
      <div class="lbl">Em aberto</div>
      <div class="val ${ab>0?'danger':''}">${fmt(ab)}</div>
    </div>`;

  // Fichas em aberto (não pagas)
  const fichasAbertas = fichas.filter(() => ab > 0);
  let htmlAbertas = '';
  if (ab <= 0) {
    htmlAbertas = '<div class="empty-detalhe" style="color:var(--success)">✓ Tudo pago!</div>';
  } else {
    // Show all fichas since we don't track per-ficha payment
    fichas.forEach(l => {
      htmlAbertas += `<div class="ficha-aberta-card">
        <div class="ficha-aberta-top">
          <span class="ficha-aberta-peca">${l.peca}</span>
          <span class="ficha-aberta-valor">${fmt(l.qtd*l.valor)}</span>
        </div>
        <div class="ficha-aberta-meta">${fmtN(l.qtd)} peças · ${l.lavado} · ${formatDate(l.data)}</div>
      </div>`;
    });
    htmlAbertas += `<div style="margin-top:8px">
      <button class="btn-primary" style="width:100%;padding:13px" onclick="abrirModalDetalhe()">
        Registrar pagamento — ${fmt(ab)}
      </button>
    </div>`;
  }
  document.getElementById('detalhe-fichas-abertas').innerHTML = htmlAbertas;

  // Pagamentos realizados
  let htmlPgtos = '';
  if (pagamentos.length === 0) {
    htmlPgtos = '<div class="empty-detalhe">Nenhum pagamento registrado</div>';
  } else {
    pagamentos.forEach(p => {
      htmlPgtos += `<div class="pgto-card">
        <div>
          <div class="pgto-card-info">Pagamento registrado</div>
          <div class="pgto-card-data">${formatDate(p.data)}</div>
        </div>
        <div class="pgto-card-valor">+ ${fmt(p.valor)}</div>
      </div>`;
    });
  }
  document.getElementById('detalhe-pagamentos').innerHTML = htmlPgtos;

  // Todas as fichas
  let htmlTodas = '';
  if (fichas.length === 0) {
    htmlTodas = '<div class="empty-detalhe">Nenhuma ficha ainda</div>';
  } else {
    fichas.forEach(l => {
      htmlTodas += `<div class="lanc-card">
        <div class="lanc-card-left">
          <div class="lanc-card-peca">${l.peca}</div>
          <div class="lanc-card-meta">${fmtN(l.qtd)} peças</div>
          <span class="lanc-tipo-chip">${l.lavado}</span>
        </div>
        <div class="lanc-card-right">
          <div class="lanc-card-total">${fmt(l.qtd*l.valor)}</div>
          <div class="lanc-card-date">${formatDate(l.data)}</div>
          <div style="display:flex;gap:5px;margin-top:5px">
          <button class="btn-edit-sm" onclick="editarFicha('${l.id}')">✏️</button>
          <button class="btn-danger-sm" onclick="deletarLanc('${l.id}')">✕</button>
        </div>
        </div>
      </div>`;
    });
  }
  document.getElementById('detalhe-todas-fichas').innerHTML = htmlTodas;
}

function abrirModalDetalhe() {
  if (clienteDetalheId) abrirModal(clienteDetalheId);
}

// Override closeModal to refresh detalhe if open
const _closeModal = closeModal;
window.closeModal = function() {
  _closeModal();
  if (paginaAtual === 'cliente-detalhe' && clienteDetalheId) {
    renderDetalheCliente(clienteDetalheId);
  }
};

window.abrirDetalheCliente = abrirDetalheCliente;
window.abrirModalDetalhe = abrirModalDetalhe;

/* ===== EDITAR FICHA ===== */
let editFichaId = null;

function editarFicha(id) {
  const l = db.lancamentos.find(x => x.id == id);
  if (!l) return;
  editFichaId = id;

  document.getElementById('e-peca').value  = l.peca;
  document.getElementById('e-data').value  = l.data;
  document.getElementById('e-qtd').value   = l.qtd;
  document.getElementById('e-valor').value = l.valor;

  // Populate lavado select
  const sel = document.getElementById('e-lavado');
  sel.innerHTML = '';
  db.lavados.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(lv => {
    const o = document.createElement('option');
    o.value = lv.nome; o.textContent = lv.nome;
    sel.appendChild(o);
  });
  sel.value = l.lavado;

  updateEditPreview();
  document.getElementById('modal-edit-bg').style.display = 'flex';
}

function updateEditPreview() {
  const qtd   = parseInt(document.getElementById('e-qtd').value)   || 0;
  const valor = parseFloat(document.getElementById('e-valor').value) || 0;
  document.getElementById('e-preview').textContent = qtd * valor > 0 ? `Total: ${fmt(qtd * valor)}` : '';
}

function closeEditModal() {
  document.getElementById('modal-edit-bg').style.display = 'none';
  editFichaId = null;
}

async function salvarEdicaoFicha() {
  const peca  = document.getElementById('e-peca').value.trim();
  const lavado= document.getElementById('e-lavado').value;
  const data  = document.getElementById('e-data').value;
  const qtd   = parseInt(document.getElementById('e-qtd').value);
  const valor = parseFloat(document.getElementById('e-valor').value);

  if (!peca || !data || !qtd || !valor) { alert('Preencha todos os campos!'); return; }

  const fichaOriginal = db.lancamentos.find(x => x.id == editFichaId);
  await salvarDoc('lancamentos', editFichaId, {
    ...fichaOriginal,
    peca, lavado, data, qtd, valor
  });

  closeEditModal();
}

window.editarFicha       = editarFicha;
window.closeEditModal    = closeEditModal;
window.salvarEdicaoFicha = salvarEdicaoFicha;
window.updateEditPreview = updateEditPreview;

/* ===== COMPARTILHAR NOTA ===== */
function imprimirNota() {
  const cid = clienteDetalheId;
  if (!cid) return;
  const c = db.clientes.find(x => x.id == cid);
  if (!c) return;

  const fichas = db.lancamentos.filter(l => l.cid == cid).sort((a,b) => a.id.localeCompare(b.id));
  const totalFat = totalLanc(cid);
  const hoje = new Date().toLocaleDateString('pt-BR');

  let linhasTabela = '';
  fichas.forEach(l => {
    linhasTabela += `<tr>
      <td>${fmtN(l.qtd)} ${l.peca}</td>
      <td>${l.lavado}</td>
      <td>${l.valor.toFixed(2).replace('.',',')}</td>
      <td>${(l.qtd*l.valor).toFixed(2).replace('.',',')}</td>
      <td>${formatDate(l.data)}</td>
    </tr>`;
  });

  const logoUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '') + '/img/logo.jpg';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nota ${c.nome}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:11pt;color:#000;padding:12mm 15mm}
.logo-wrap{text-align:center;margin-bottom:16px}
.logo-wrap img{height:65px;width:auto}
.info{margin-bottom:14px;line-height:1.8}
.info strong{font-weight:bold}
table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:10pt}
th{background:#f0f0f0;border:1px solid #ccc;padding:7px 8px;text-align:left;font-weight:bold}
td{border:1px solid #ccc;padding:6px 8px;vertical-align:top}
tr:nth-child(even) td{background:#fafafa}
.total-wrap{text-align:right;margin-top:6px}
.total-line{display:inline-flex;gap:20px;border-top:2px solid #000;padding-top:6px;font-size:12pt;font-weight:bold}
.assin{margin-top:36px;font-size:10pt;color:#555}
.btn-compartilhar{display:block;width:100%;margin-top:20px;padding:14px;background:#1d4ed8;color:#fff;border:none;border-radius:10px;font-size:15pt;font-weight:700;cursor:pointer;font-family:Arial,sans-serif}
@media print{.btn-compartilhar{display:none}body{padding:12mm 15mm}}
</style>
</head>
<body>
<div class="logo-wrap"><img src="${logoUrl}" onerror="this.style.display='none'"></div>
<div class="info">
  <div><strong>Contato:</strong> (83) 981267379 / (83) 981053327</div>
  <div><strong>Cliente:</strong> ${c.nome}</div>
  <div><strong>Data:</strong> ${hoje}</div>
</div>
<table>
  <thead><tr><th>Quantidade:</th><th>Lavado:</th><th>Valor:</th><th>Total:</th><th>Data:</th></tr></thead>
  <tbody>${linhasTabela}</tbody>
</table>
<div class="total-wrap">
  <div class="total-line">
    <span>TOTAL R$:</span>
    <span>${totalFat.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
  </div>
</div>
<div class="assin">Assinatura do Cliente: _______________________</div>
<button class="btn-compartilhar" onclick="window.print()">Salvar / Compartilhar PDF</button>
</body>
</html>`;

  // Usar blob URL — funciona no Safari iOS
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.location.href = url;
}

window.imprimirNota = imprimirNota;
