import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { fmtN, formatDate, gerarId, hojeISO } from '../lib/helpers';

export default function Funcionario({ clientes, lancamentos, lavados, salvarDoc }) {
  const [cid, setCid]       = useState('');
  const [data, setData]     = useState(hojeISO());
  const [peca, setPeca]     = useState('');
  const [lavado, setLavado] = useState('');
  const [qtd, setQtd]       = useState('');
  const [erro, setErro]     = useState('');
  const [ok, setOk]         = useState(false);

  const sortedClientes = [...clientes].sort((a,b) => a.nome.localeCompare(b.nome));
  const sortedLavados  = [...lavados].sort((a,b) => a.nome.localeCompare(b.nome));

  const nomeCli = id => { const c = clientes.find(x => x.id === id); return c ? c.nome : '?'; };

  const salvar = async () => {
    setErro(''); setOk(false);
    if (!cid || !data || !peca.trim() || !qtd || parseInt(qtd) <= 0) {
      setErro('Preencha todos os campos.'); return;
    }
    const lavadoDoc = lavados.find(lv => lv.nome === (lavado || sortedLavados[0]?.nome));
    const valor = lavadoDoc ? lavadoDoc.valor : 0;
    await salvarDoc('lancamentos', gerarId(), { cid, data, peca: peca.trim(), lavado: lavado || sortedLavados[0]?.nome || '', qtd: parseInt(qtd), valor });
    setCid(''); setPeca(''); setQtd(''); setOk(true);
    setTimeout(() => setOk(false), 3000);
  };

  const fichasHoje = [...lancamentos].filter(l => l.data === hojeISO()).sort((a,b) => b.id.localeCompare(a.id));

  return (
    <div className="func-wrap">
      <div className="func-header">
        <img src="/img/logo-nova-lavanderia.png" alt="Lavanderia Emanoel" className="func-logo" />
        <button className="btn-sair-mobile" onClick={() => { if(confirm('Deseja sair?')) signOut(auth); }}>Sair</button>
      </div>

      <div className="func-body">
        <h2 className="page-title" style={{marginBottom:18}}>Nova ficha</h2>

        <div className="form-card" style={{display:'block'}}>
          <div className="form-group"><label>Cliente</label>
            <select value={cid} onChange={e => setCid(e.target.value)}>
              <option value="">Selecione o cliente...</option>
              {sortedClientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Data</label><input type="date" value={data} onChange={e => setData(e.target.value)} /></div>
          <div className="form-group"><label>Peca</label><input value={peca} onChange={e => setPeca(e.target.value)} placeholder="Ex: Shorts, Calcas..." autoCorrect="off" /></div>
          <div className="form-group"><label>Lavado</label>
            <select value={lavado} onChange={e => setLavado(e.target.value)}>
              {sortedLavados.map(lv => <option key={lv.id} value={lv.nome}>{lv.nome}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Quantidade</label><input type="number" value={qtd} onChange={e => setQtd(e.target.value)} placeholder="0" inputMode="numeric" /></div>
          {erro && <div className="login-erro">{erro}</div>}
          {ok   && <div className="func-ok">Ficha salva com sucesso!</div>}
          <div className="form-actions" style={{marginTop:16}}>
            <button className="btn-primary" onClick={salvar}>Salvar ficha</button>
          </div>
        </div>

        <div className="section-label">Fichas do dia</div>
        {fichasHoje.length === 0
          ? <div style={{textAlign:'center',padding:'2rem',color:'var(--text-4)',fontSize:'.82rem'}}>Nenhuma ficha lancada hoje</div>
          : fichasHoje.map(l => (
              <div key={l.id} className="lanc-card">
                <div className="lanc-card-left">
                  <div className="lanc-card-peca">{l.peca}</div>
                  <div className="lanc-card-meta">{nomeCli(l.cid)} · {fmtN(l.qtd)} pecas</div>
                  <span className="lanc-tipo-chip">{l.lavado}</span>
                </div>
                <div className="lanc-card-right">
                  <div className="lanc-card-date">{formatDate(l.data)}</div>
                </div>
              </div>
            ))
        }
      </div>
    </div>
  );
}
