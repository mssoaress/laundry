import { useState } from 'react';
import { fmt, fmtN, formatDate, initials, totalLanc, totalPago, totalAberto, gerarId, gerarNota } from '../lib/helpers';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { IconBack } from '../components/Icons';

export default function DetalheCliente({ cid, clientes, lancamentos, pagamentos, lavados, salvarDoc, onBack }) {
  const c = clientes.find(x => x.id === cid);
  const [modalPgto, setModalPgto]     = useState(false);
  const [modalValor, setModalValor]   = useState('');
  const [editFicha, setEditFicha]     = useState(null);
  const [ePeca, setEPeca]             = useState('');
  const [eLavado, setELavado]         = useState('');
  const [eData, setEData]             = useState('');
  const [eQtd, setEQtd]               = useState('');
  const [eValor, setEValor]           = useState('');

  if (!c) return null;

  const fichas     = [...lancamentos.filter(l => l.cid === cid)].sort((a, b) => b.id.localeCompare(a.id));
  const pgtos      = [...pagamentos.filter(p => p.cid === cid)].sort((a, b) => b.data.localeCompare(a.data));
  const lancado    = totalLanc(cid, lancamentos);
  const pago       = totalPago(cid, pagamentos);
  const ab         = totalAberto(cid, lancamentos, pagamentos);
  const totalPcs   = fichas.reduce((s, l) => s + l.qtd, 0);

  const registrarPagamento = async () => {
    const val = parseFloat(modalValor);
    if (!val || val <= 0) { alert('Valor invalido.'); return; }
    await salvarDoc('pagamentos', gerarId(), { cid, valor: val, data: new Date().toISOString().split('T')[0] });
    setModalPgto(false); setModalValor('');
  };

  const abrirEditar = l => {
    setEditFicha(l.id); setEPeca(l.peca); setELavado(l.lavado);
    setEData(l.data); setEQtd(String(l.qtd)); setEValor(String(l.valor));
  };

  const salvarEdicao = async () => {
    if (!ePeca || !eData || !eQtd) { alert('Preencha peca, data e quantidade.'); return; }
    const orig = lancamentos.find(x => x.id === editFicha);
    await salvarDoc('lancamentos', editFicha, { ...orig, peca: ePeca, lavado: eLavado, data: eData, qtd: parseInt(eQtd), valor: parseFloat(eValor) || 0 });
    setEditFicha(null);
  };

  const deletarLanc = async id => {
    if (!confirm('Remover esta ficha?')) return;
    await deleteDoc(doc(db, 'lancamentos', id));
  };

  const compartilharNota = () => {
    const logoUrl = window.location.origin + '/img/logo-nova-lavanderia.png';
    const html = gerarNota(c, [...fichas].sort((a,b) => a.id.localeCompare(b.id)), logoUrl);
    const blob = new Blob([html], { type: 'text/html' });
    window.location.href = URL.createObjectURL(blob);
  };

  const ePreview = (parseInt(eQtd)||0) * (parseFloat(eValor)||0);

  return (
    <div style={{animation:'fadeUp .18s ease'}}>
      <div className="page-header">
        <button className="btn-back" onClick={onBack}><IconBack /> Voltar</button>
      </div>

      {/* HEADER CLIENTE */}
      <div className="detalhe-header">
        <div style={{display:'flex',alignItems:'center',gap:14,width:'100%'}}>
          <div className="detalhe-avatar">{initials(c.nome)}</div>
          <div style={{flex:1,minWidth:0}}>
            <div className="detalhe-nome">{c.nome}</div>
            <div className="detalhe-tel">{c.tel || 'Sem telefone'}</div>
            <div style={{fontSize:'.68rem',color:'rgba(255,255,255,.5)',marginTop:3}}>
              {fichas.length} ficha{fichas.length !== 1 ? 's' : ''} · {fmtN(totalPcs)} pecas
            </div>
          </div>
        </div>
        <div style={{display:'flex',gap:8,marginTop:16,width:'100%'}}>
          <button onClick={compartilharNota} style={{flex:1,background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.2)',borderRadius:'var(--r)',color:'#fff',fontSize:'.82rem',fontWeight:600,padding:10,cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>
            Compartilhar nota
          </button>
          <button onClick={() => { setModalPgto(true); setModalValor(''); }} style={{flex:1,background:'rgba(255,255,255,.22)',border:'none',borderRadius:'var(--r)',color:'#fff',fontSize:'.82rem',fontWeight:700,padding:10,cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>
            Registrar pagamento
          </button>
        </div>
      </div>

      {/* RESUMO */}
      <div className="detalhe-resumo">
        <div className="detalhe-stat"><div className="lbl">Lancado</div><div className="val">{fmt(lancado)}</div></div>
        <div className="detalhe-stat"><div className="lbl">Recebido</div><div className={`val ${pago>0?'success':''}`}>{fmt(pago)}</div></div>
        <div className="detalhe-stat"><div className="lbl">A receber</div><div className={`val ${ab>0?'danger':''}`}>{fmt(ab)}</div></div>
      </div>

      {/* FICHAS EM ABERTO */}
      <div className="section-label">Fichas em aberto</div>
      {ab <= 0
        ? <div className="empty-detalhe" style={{color:'var(--success)'}}>Tudo pago</div>
        : <>
            {fichas.map(l => (
              <div key={l.id} className="ficha-aberta-card">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                  <span style={{fontWeight:600,fontSize:'.88rem'}}>{l.peca}</span>
                  <span style={{fontWeight:700,fontSize:'.9rem',color:'var(--danger)'}}>{fmt(l.qtd*l.valor)}</span>
                </div>
                <div style={{fontSize:'.71rem',color:'var(--text-3)'}}>{fmtN(l.qtd)} pecas · {l.lavado} · {formatDate(l.data)}</div>
              </div>
            ))}
            <div style={{marginTop:10}}>
              <button className="btn-primary" style={{width:'100%',padding:13}} onClick={() => { setModalPgto(true); setModalValor(''); }}>
                Registrar pagamento — {fmt(ab)}
              </button>
            </div>
          </>
      }

      {/* PAGAMENTOS */}
      <div className="section-label">Pagamentos realizados</div>
      {pgtos.length === 0
        ? <div className="empty-detalhe">Nenhum pagamento registrado</div>
        : pgtos.map(p => (
            <div key={p.id} className="pgto-card">
              <div>
                <div style={{fontSize:'.8rem',color:'var(--text-2)',fontWeight:500}}>Pagamento registrado</div>
                <div style={{fontSize:'.68rem',color:'var(--text-3)'}}>{formatDate(p.data)}</div>
              </div>
              <div className="pgto-card-valor">+ {fmt(p.valor)}</div>
            </div>
          ))
      }

      {/* TODAS AS FICHAS */}
      <div className="section-label">Todas as fichas</div>
      {fichas.length === 0
        ? <div className="empty-detalhe">Nenhuma ficha ainda</div>
        : fichas.map(l => (
            <div key={l.id} className="lanc-card">
              <div className="lanc-card-left">
                <div className="lanc-card-peca">{l.peca}</div>
                <div className="lanc-card-meta">{fmtN(l.qtd)} pecas</div>
                <span className="lanc-tipo-chip">{l.lavado}</span>
              </div>
              <div className="lanc-card-right">
                <div className="lanc-card-total">{fmt(l.qtd*l.valor)}</div>
                <div className="lanc-card-date">{formatDate(l.data)}</div>
                <div style={{display:'flex',gap:5,marginTop:6,justifyContent:'flex-end'}}>
                  <button className="btn-edit-sm" onClick={() => abrirEditar(l)}>Editar</button>
                  <button className="btn-danger-sm" onClick={() => deletarLanc(l.id)}>Remover</button>
                </div>
              </div>
            </div>
          ))
      }

      {/* MODAL PAGAMENTO */}
      {modalPgto && (
        <div className="modal-backdrop" onClick={() => setModalPgto(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">Registrar pagamento</div>
            <div className="form-group"><label>Cliente</label><input disabled value={c.nome} /></div>
            <div className="form-group"><label>Valor em aberto</label><input disabled value={fmt(ab)} className="input-danger" /></div>
            <div className="form-group"><label>Valor pago (R$)</label><input type="number" value={modalValor} onChange={e => setModalValor(e.target.value)} placeholder="0,00" step="0.01" inputMode="decimal" autoFocus /></div>
            <div className="form-actions">
              <button className="btn-primary" onClick={registrarPagamento}>Confirmar</button>
              <button className="btn-ghost" onClick={() => setModalPgto(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR FICHA */}
      {editFicha && (
        <div className="modal-backdrop" onClick={() => setEditFicha(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">Editar ficha</div>
            <div className="form-group"><label>Peca</label><input value={ePeca} onChange={e => setEPeca(e.target.value)} placeholder="Ex: Shorts, Calcas..." autoCorrect="off" /></div>
            <div className="form-group">
              <label>Lavado</label>
              <select value={eLavado} onChange={e => setELavado(e.target.value)}>
                {[...lavados].sort((a,b)=>a.nome.localeCompare(b.nome)).map(lv => <option key={lv.id} value={lv.nome}>{lv.nome}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Data</label><input type="date" value={eData} onChange={e => setEData(e.target.value)} /></div>
            <div className="form-row-2">
              <div className="form-group"><label>Quantidade</label><input type="number" value={eQtd} onChange={e => setEQtd(e.target.value)} inputMode="numeric" /></div>
              <div className="form-group"><label>Valor unit. (R$) <span style={{fontWeight:400,textTransform:'none',color:'var(--text-4)'}}>(opcional)</span></label><input type="number" value={eValor} onChange={e => setEValor(e.target.value)} step="0.01" inputMode="decimal" /></div>
            </div>
            {ePreview > 0 && <div className="preview-total">Total: {fmt(ePreview)}</div>}
            <div className="form-actions">
              <button className="btn-primary" onClick={salvarEdicao}>Salvar</button>
              <button className="btn-ghost" onClick={() => setEditFicha(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
