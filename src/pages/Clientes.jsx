import { useState } from 'react';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { fmt, fmtN, initials, mesAtual, anoAtual, totalLanc, totalPago, totalAberto, pecasDeCliente, lancsMes, gerarId } from '../lib/helpers';
import { IconPlus } from '../components/Icons';
import DetalheCliente from './DetalheCliente';

export default function Clientes({ clientes, lancamentos, pagamentos, lavados, salvarDoc }) {
  const [showForm, setShowForm]   = useState(false);
  const [nome, setNome]           = useState('');
  const [tel, setTel]             = useState('');
  const [detalheId, setDetalheId] = useState(null);
  const [modalPgtoCid, setModalPgtoCid] = useState(null);
  const [modalValor, setModalValor]     = useState('');

  const mes = mesAtual(), ano = anoAtual();

  const salvar = async () => {
    if (!nome.trim()) { alert('Digite o nome do cliente.'); return; }
    await salvarDoc('clientes', gerarId(), { nome: nome.trim(), tel: tel.trim() });
    setNome(''); setTel(''); setShowForm(false);
  };

  const deletar = async (id, nome) => {
    if (!confirm(`Remover "${nome}" e todos os dados vinculados?`)) return;
    const batch = writeBatch(db);
    batch.delete(doc(db, 'clientes', id));
    lancamentos.filter(l => l.cid === id).forEach(l => batch.delete(doc(db, 'lancamentos', l.id)));
    pagamentos.filter(p => p.cid === id).forEach(p => batch.delete(doc(db, 'pagamentos', p.id)));
    await batch.commit();
  };

  const registrarPagamento = async () => {
    const val = parseFloat(modalValor);
    if (!val || val <= 0) { alert('Valor invalido.'); return; }
    await salvarDoc('pagamentos', gerarId(), { cid: modalPgtoCid, valor: val, data: new Date().toISOString().split('T')[0] });
    setModalPgtoCid(null); setModalValor('');
  };

  if (detalheId) return (
    <DetalheCliente
      cid={detalheId}
      clientes={clientes} lancamentos={lancamentos} pagamentos={pagamentos} lavados={lavados}
      salvarDoc={salvarDoc}
      onBack={() => setDetalheId(null)}
    />
  );

  const sorted = [...clientes].sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div style={{animation:'fadeUp .18s ease'}}>
      <div className="page-header">
        <div><h2 className="page-title">Clientes</h2></div>
        <button className="btn-add" onClick={() => setShowForm(v => !v)}>
          <IconPlus /> Novo cliente
        </button>
      </div>

      {showForm && (
        <div className="form-card">
          <div className="form-card-title">Novo cliente</div>
          <div className="form-group"><label>Nome</label><input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" autoCorrect="off" /></div>
          <div className="form-group"><label>Telefone</label><input value={tel} onChange={e => setTel(e.target.value)} type="tel" placeholder="(83) 00000-0000" /></div>
          <div className="form-actions">
            <button className="btn-primary" onClick={salvar}>Salvar</button>
            <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div id="client-list">
        {sorted.length === 0
          ? <div style={{textAlign:'center',padding:'3rem',color:'var(--text-4)',fontSize:'.85rem'}}>Nenhum cliente cadastrado</div>
          : sorted.map(c => {
              const pm     = pecasDeCliente(c.id, lancsMes(lancamentos, mes, ano));
              const lancado = totalLanc(c.id, lancamentos);
              const pago    = totalPago(c.id, pagamentos);
              const ab      = totalAberto(c.id, lancamentos, pagamentos);
              return (
                <div key={c.id} className="client-card" onClick={() => setDetalheId(c.id)}>
                  <div className="avatar" style={{width:40,height:40,fontSize:13,flexShrink:0}}>{initials(c.nome)}</div>
                  <div className="client-card-info">
                    <div className="client-card-name">{c.nome}</div>
                    <div className="client-card-stats">
                      <span className="client-card-stat">{c.tel || 'Sem telefone'}</span>
                      <span className="client-card-stat">Mes: <span>{fmtN(pm)} pc</span></span>
                    </div>
                    <div style={{fontSize:'.7rem',color:'var(--text-3)',marginTop:3}}>
                      Recebido: <strong style={{color:'var(--success)'}}>{fmt(pago)}</strong>
                      &nbsp;|&nbsp;
                      Lancado: <strong style={{color:'var(--text-1)'}}>{fmt(lancado)}</strong>
                    </div>
                  </div>
                  <div className="client-card-actions">
                    <span className={`client-ab ${ab === 0 ? 'zero' : ''}`}>{ab === 0 ? 'Em dia' : fmt(ab)}</span>
                    <button className="btn-quitar" onClick={e => { e.stopPropagation(); setModalPgtoCid(c.id); setModalValor(''); }}>Pagamento</button>
                    <button className="btn-danger-sm" onClick={e => { e.stopPropagation(); deletar(c.id, c.nome); }}>Remover</button>
                  </div>
                </div>
              );
            })
        }
      </div>

      {modalPgtoCid && (() => {
        const c = clientes.find(x => x.id === modalPgtoCid);
        const ab = totalAberto(modalPgtoCid, lancamentos, pagamentos);
        return (
          <div className="modal-backdrop" onClick={() => setModalPgtoCid(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <div className="modal-title">Registrar pagamento</div>
              <div className="form-group"><label>Cliente</label><input disabled value={c?.nome || ''} /></div>
              <div className="form-group"><label>Valor em aberto</label><input disabled value={fmt(ab)} className="input-danger" /></div>
              <div className="form-group"><label>Valor pago (R$)</label><input type="number" value={modalValor} onChange={e => setModalValor(e.target.value)} placeholder="0,00" step="0.01" inputMode="decimal" /></div>
              <div className="form-actions">
                <button className="btn-primary" onClick={registrarPagamento}>Confirmar</button>
                <button className="btn-ghost" onClick={() => setModalPgtoCid(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
