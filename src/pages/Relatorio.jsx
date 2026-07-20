import { useState } from 'react';
import { writeBatch, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MESES, fmt, fmtN, initials, mesAtual, anoAtual, totalAberto, pecasDeCliente, fatDeCliente, pagoDeCliente, pagosMes, pagosIntervalo, lancsMes, lancsIntervalo, gerarId, semanaAtual } from '../lib/helpers';

export default function Relatorio({ clientes, lancamentos, pagamentos }) {
  const [periodo, setPeriodo] = useState('mensal');
  const [mes, setMes]         = useState(mesAtual());
  const [ano, setAno]         = useState(anoAtual());
  const sw = semanaAtual();
  const [swIni, setSwIni]     = useState(sw.ini);
  const [swFim, setSwFim]     = useState(sw.fim);
  const [sel, setSel]         = useState([]);
  const [selAll, setSelAll]   = useState(false);

  const anos = [...new Set(lancamentos.map(l => l.data.substring(0,4)))].sort().reverse();
  if (!anos.includes(anoAtual())) anos.unshift(anoAtual());

  let lancsP = [], pgtoP = [], labelP = '';
  if (periodo === 'mensal') {
    lancsP = lancsMes(lancamentos, mes, ano);
    pgtoP  = pagosMes(pagamentos, mes, ano);
    labelP = MESES[parseInt(mes)-1] + '/' + ano;
  } else {
    if (swIni && swFim && swIni <= swFim) {
      lancsP = lancsIntervalo(lancamentos, swIni, swFim);
      pgtoP  = pagosIntervalo(pagamentos, swIni, swFim);
      labelP = swIni.split('-').reverse().join('/') + ' a ' + swFim.split('-').reverse().join('/');
    }
  }

  const totalRecebido = pgtoP.reduce((s,p) => s + p.valor, 0);
  const totalLancado  = lancsP.reduce((s,l) => s + l.qtd * l.valor, 0);
  const totalPecas    = lancsP.reduce((s,l) => s + l.qtd, 0);
  const clientesAt    = new Set(lancsP.map(l => l.cid)).size;

  const clientesTabela = clientes.filter(c => fatDeCliente(c.id, lancsP) > 0 || pecasDeCliente(c.id, lancsP) > 0);
  const maxPecas = Math.max(...clientes.map(c => pecasDeCliente(c.id, lancsP)), 1);

  const toggleSel = id => setSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => {
    if (selAll) { setSel([]); setSelAll(false); }
    else { setSel(clientesTabela.map(c => c.id)); setSelAll(true); }
  };

  const marcarPago = async () => {
    if (!sel.length) return;
    const nomes = sel.map(id => clientes.find(c => c.id === id)?.nome).join(', ');
    if (!confirm(`Marcar como pago: ${nomes}?`)) return;
    const batch = writeBatch(db);
    const hoje = new Date().toISOString().split('T')[0];
    sel.forEach(id => {
      const ab = totalAberto(id, lancamentos, pagamentos);
      if (ab > 0) batch.set(doc(db, 'pagamentos', gerarId()), { cid: id, valor: ab, data: hoje });
    });
    await batch.commit();
    setSel([]); setSelAll(false);
  };

  const totalSel = sel.reduce((s, id) => s + totalAberto(id, lancamentos, pagamentos), 0);

  return (
    <div style={{animation:'fadeUp .18s ease'}}>
      <div className="page-header"><div><h2 className="page-title">Relatorio</h2></div></div>

      <div className="relatorio-filtros">
        <div className="filtro-tabs">
          <button className={`filtro-tab ${periodo==='mensal'?'active':''}`} onClick={() => setPeriodo('mensal')}>Mensal</button>
          <button className={`filtro-tab ${periodo==='semanal'?'active':''}`} onClick={() => setPeriodo('semanal')}>Semanal</button>
        </div>
        {periodo === 'mensal'
          ? <div className="filtro-controles">
              <select className="select-inline" value={mes} onChange={e => setMes(e.target.value)}>
                {MESES.map((m,i) => <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>)}
              </select>
              <select className="select-inline" value={ano} onChange={e => setAno(e.target.value)}>
                {anos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          : <div className="filtro-controles">
              <input type="date" className="select-inline" value={swIni} onChange={e => setSwIni(e.target.value)} />
              <span className="filtro-sep">ate</span>
              <input type="date" className="select-inline" value={swFim} onChange={e => setSwFim(e.target.value)} />
            </div>
        }
      </div>

      <div className="metrics" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        <div className="metric"><div className="lbl">Recebido no periodo</div><div className="val success">{fmt(totalRecebido)}</div></div>
        <div className="metric"><div className="lbl">Lancado no periodo</div><div className="val">{fmt(totalLancado)}</div></div>
        <div className="metric"><div className="lbl">Pecas lavadas</div><div className="val">{fmtN(totalPecas)}</div></div>
      </div>

      <div className="section-label">Pecas por cliente</div>
      <div className="card">
        {clientesTabela.length === 0
          ? <p style={{padding:'18px 16px',color:'var(--text-4)',fontSize:'.82rem'}}>Nenhuma peca em {labelP || 'nenhum periodo'}</p>
          : clientesTabela.map(c => {
              const pm = pecasDeCliente(c.id, lancsP);
              const pct = Math.round(pm / maxPecas * 100);
              return (
                <div key={c.id} className="bar-row">
                  <div className="bar-label">{c.nome}</div>
                  <div className="bar-wrap"><div className="bar-fill" style={{width:`${pct}%`}} /></div>
                  <div className="bar-value">{fmtN(pm)}</div>
                </div>
              );
            })
        }
      </div>

      <div className="section-label">Detalhamento</div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" checked={selAll} onChange={toggleAll} /></th>
                <th>Cliente</th><th>Pecas</th><th>Lancado</th><th>Recebido</th><th>A receber</th><th></th>
              </tr>
            </thead>
            <tbody>
              {clientesTabela.length === 0
                ? <tr className="empty-row"><td colSpan={7}>Nenhuma ficha em {labelP || 'nenhum periodo'}</td></tr>
                : clientesTabela.map(c => {
                    const pm      = pecasDeCliente(c.id, lancsP);
                    const lancado = fatDeCliente(c.id, lancsP);
                    const recebido= pagoDeCliente(c.id, pgtoP);
                    const ab      = totalAberto(c.id, lancamentos, pagamentos);
                    return (
                      <tr key={c.id}>
                        <td><input type="checkbox" checked={sel.includes(c.id)} onChange={() => toggleSel(c.id)} /></td>
                        <td><div className="client-row"><div className="avatar">{initials(c.nome)}</div>{c.nome}</div></td>
                        <td>{fmtN(pm)}</td>
                        <td>{fmt(lancado)}</td>
                        <td>{fmt(recebido)}</td>
                        <td style={{color: ab>0?'var(--danger)':'var(--success)', fontWeight:700}}>{fmt(ab)}</td>
                        <td><button className="btn-quitar" onClick={() => { setSel([c.id]); }}>Pgto</button></td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
        {sel.length > 0 && (
          <div className="bulk-bar">
            <span>{sel.length} cliente(s) selecionado(s)</span>
            <button className="btn-primary btn-sm" onClick={marcarPago}>Marcar como pago</button>
            <button className="btn-ghost btn-sm" onClick={() => { setSel([]); setSelAll(false); }}>Cancelar</button>
          </div>
        )}
      </div>
    </div>
  );
}
