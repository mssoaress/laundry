import { useState } from 'react';
import { fmt, fmtN, formatDate, initials, mesAtual, anoAtual, gerarId } from '../lib/helpers';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { IconPlus } from '../components/Icons';

export default function Fichas({ clientes, lancamentos, pagamentos, lavados, salvarDoc }) {
  const [showForm, setShowForm] = useState(false);
  const [fCid, setFCid]         = useState('');
  const [fData, setFData]       = useState(new Date().toISOString().split('T')[0]);
  const [fPeca, setFPeca]       = useState('');
  const [fLavado, setFLavado]   = useState('');
  const [fQtd, setFQtd]         = useState('');
  const [fValor, setFValor]     = useState('');
  const [filCid, setFilCid]     = useState('');
  const [filMes, setFilMes]     = useState('');
  const [editId, setEditId]     = useState(null);
  const [ePeca, setEPeca]       = useState('');
  const [eLavado, setELavado]   = useState('');
  const [eData, setEData]       = useState('');
  const [eQtd, setEQtd]         = useState('');
  const [eValor, setEValor]     = useState('');

  const nomeCli = id => { const c = clientes.find(x => x.id === id); return c ? c.nome : '?'; };
  const sortedLavados = [...lavados].sort((a,b) => a.nome.localeCompare(b.nome));
  const sortedClientes = [...clientes].sort((a,b) => a.nome.localeCompare(b.nome));

  const salvar = async () => {
    if (!fCid || !fData || !fPeca.trim() || !fQtd) { alert('Preencha cliente, data, peca e quantidade.'); return; }
    await salvarDoc('lancamentos', gerarId(), { cid: fCid, data: fData, peca: fPeca.trim(), lavado: fLavado || (sortedLavados[0]?.nome || ''), qtd: parseInt(fQtd), valor: parseFloat(fValor) || 0 });
    setFPeca(''); setFQtd(''); setFValor(''); setShowForm(false);
  };

  const deletar = async id => {
    if (!confirm('Remover esta ficha?')) return;
    await deleteDoc(doc(db, 'lancamentos', id));
  };

  const abrirEditar = l => {
    setEditId(l.id); setEPeca(l.peca); setELavado(l.lavado);
    setEData(l.data); setEQtd(String(l.qtd)); setEValor(String(l.valor));
  };

  const salvarEdicao = async () => {
    if (!ePeca || !eData || !eQtd) { alert('Preencha peca, data e quantidade.'); return; }
    const orig = lancamentos.find(x => x.id === editId);
    await salvarDoc('lancamentos', editId, { ...orig, peca: ePeca, lavado: eLavado, data: eData, qtd: parseInt(eQtd), valor: parseFloat(eValor) || 0 });
    setEditId(null);
  };

  let lancs = [...lancamentos].sort((a,b) => b.id.localeCompare(a.id));
  if (filCid) lancs = lancs.filter(l => l.cid === filCid);
  if (filMes) lancs = lancs.filter(l => l.data.substring(5,7) === filMes);

  const total = lancs.reduce((s,l) => s + l.qtd*l.valor, 0);
  const pecas = lancs.reduce((s,l) => s + l.qtd, 0);

  const preview = (parseInt(fQtd)||0) * (parseFloat(fValor)||0);
  const ePreview = (parseInt(eQtd)||0) * (parseFloat(eValor)||0);

  return (
    <div style={{animation:'fadeUp .18s ease'}}>
      <div className="page-header">
        <div><h2 className="page-title">Fichas</h2></div>
        <button className="btn-add" onClick={() => setShowForm(v => !v)}><IconPlus /> Nova ficha</button>
      </div>

      {showForm && (
        <div className="form-card">
          <div className="form-card-title">Nova ficha</div>
          <div className="form-group"><label>Cliente</label>
            <select value={fCid} onChange={e => setFCid(e.target.value)}>
              <option value="">Selecione...</option>
              {sortedClientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Data</label><input type="date" value={fData} onChange={e => setFData(e.target.value)} /></div>
          <div className="form-group"><label>Peca</label><input value={fPeca} onChange={e => setFPeca(e.target.value)} placeholder="Ex: Shorts, Calcas..." autoCorrect="off" /></div>
          <div className="form-group"><label>Lavado</label>
            <select value={fLavado} onChange={e => setFLavado(e.target.value)}>
              {sortedLavados.map(lv => <option key={lv.id} value={lv.nome}>{lv.nome}</option>)}
            </select>
          </div>
          <div className="form-row-2">
            <div className="form-group"><label>Quantidade</label><input type="number" value={fQtd} onChange={e => setFQtd(e.target.value)} placeholder="0" inputMode="numeric" /></div>
            <div className="form-group">
              <label>Valor unit. (R$) <span style={{fontWeight:400,textTransform:'none',color:'var(--text-4)'}}>(opcional)</span></label>
              <input type="number" value={fValor} onChange={e => setFValor(e.target.value)} placeholder="0,00" step="0.01" inputMode="decimal" />
            </div>
          </div>
          {preview > 0 && <div className="preview-total">Total: {fmt(preview)}</div>}
          <div className="form-actions">
            <button className="btn-primary" onClick={salvar}>Salvar ficha</button>
            <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="filter-bar">
        <select value={filCid} onChange={e => setFilCid(e.target.value)}>
          <option value="">Todos os clientes</option>
          {sortedClientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={filMes} onChange={e => setFilMes(e.target.value)}>
          <option value="">Todos os meses</option>
          {['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m,i) => (
            <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>
          ))}
        </select>
      </div>

      {lancs.length === 0
        ? <div style={{textAlign:'center',padding:'3rem',color:'var(--text-4)',fontSize:'.85rem'}}>Nenhuma ficha encontrada</div>
        : <>
            {lancs.map(l => (
              <div key={l.id} className="lanc-card">
                <div className="lanc-card-left">
                  <div className="lanc-card-peca">{l.peca}</div>
                  <div className="lanc-card-meta">{nomeCli(l.cid)} · {fmtN(l.qtd)} pecas</div>
                  <span className="lanc-tipo-chip">{l.lavado}</span>
                </div>
                <div className="lanc-card-right">
                  <div className="lanc-card-total">{fmt(l.qtd*l.valor)}</div>
                  <div className="lanc-card-date">{formatDate(l.data)}</div>
                  <div style={{display:'flex',gap:5,marginTop:6,justifyContent:'flex-end'}}>
                    <button className="btn-edit-sm" onClick={() => abrirEditar(l)}>Editar</button>
                    <button className="btn-danger-sm" onClick={() => deletar(l.id)}>Remover</button>
                  </div>
                </div>
              </div>
            ))}
            <div className="card" style={{padding:'11px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4}}>
              <span style={{fontSize:'.73rem',color:'var(--text-3)',fontWeight:600}}>{fmtN(pecas)} pecas · {lancs.length} itens</span>
              <span style={{fontSize:'.88rem',fontWeight:700,color:'var(--text-1)'}}>{fmt(total)}</span>
            </div>
          </>
      }

      {/* MODAL EDITAR */}
      {editId && (
        <div className="modal-backdrop" onClick={() => setEditId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">Editar ficha</div>
            <div className="form-group"><label>Peca</label><input value={ePeca} onChange={e => setEPeca(e.target.value)} autoCorrect="off" /></div>
            <div className="form-group"><label>Lavado</label>
              <select value={eLavado} onChange={e => setELavado(e.target.value)}>
                {sortedLavados.map(lv => <option key={lv.id} value={lv.nome}>{lv.nome}</option>)}
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
              <button className="btn-ghost" onClick={() => setEditId(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
