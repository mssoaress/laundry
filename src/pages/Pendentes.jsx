import { useState } from 'react';
import { writeBatch, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { fmt, fmtN, formatDate, initials, totalLanc, totalPago, totalAberto, gerarId } from '../lib/helpers';

export default function Pendentes({ clientes, lancamentos, pagamentos }) {
  const [sel, setSel]       = useState([]);
  const [selAll, setSelAll] = useState(false);

  const pendentes = clientes.filter(c => totalAberto(c.id, lancamentos, pagamentos) > 0);
  const totalGeral = pendentes.reduce((s, c) => s + totalAberto(c.id, lancamentos, pagamentos), 0);

  const toggleSel = id => setSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => {
    if (selAll) { setSel([]); setSelAll(false); }
    else { setSel(pendentes.map(c => c.id)); setSelAll(true); }
  };

  const quitar = async id => {
    const ab = totalAberto(id, lancamentos, pagamentos);
    const nome = clientes.find(c => c.id === id)?.nome || '?';
    if (!confirm(`Quitar ${fmt(ab)} de ${nome}?`)) return;
    await setDoc(doc(db, 'pagamentos', gerarId()), { cid: id, valor: ab, data: new Date().toISOString().split('T')[0] });
  };

  const quitarSelecionados = async () => {
    const total = sel.reduce((s, id) => s + totalAberto(id, lancamentos, pagamentos), 0);
    if (!confirm(`Quitar ${fmt(total)} de ${sel.length} cliente(s)?`)) return;
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
      <div className="page-header">
        <div>
          <h2 className="page-title">Pendentes</h2>
          <span className="page-subtitle" style={{color:'var(--text-3)'}}>
            {pendentes.length > 0 ? `${pendentes.length} pendente(s) · ${fmt(totalGeral)}` : 'Tudo em dia'}
          </span>
        </div>
      </div>

      <div className="metrics">
        <div className="metric"><div className="lbl">Pendentes</div><div className="val danger">{pendentes.length}</div></div>
        <div className="metric"><div className="lbl">Total em aberto</div><div className="val danger">{fmt(totalGeral)}</div></div>
        <div className="metric"><div className="lbl">Total lancado</div><div className="val">{fmt(clientes.reduce((s,c) => s + totalLanc(c.id, lancamentos), 0))}</div></div>
        <div className="metric"><div className="lbl">Total recebido</div><div className="val success">{fmt(clientes.reduce((s,c) => s + totalPago(c.id, pagamentos), 0))}</div></div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" checked={selAll} onChange={toggleAll} /></th>
                <th>Cliente</th><th>Em aberto</th><th>Ultima ficha</th><th></th>
              </tr>
            </thead>
            <tbody>
              {pendentes.length === 0
                ? <tr className="empty-row"><td colSpan={5} style={{color:'var(--success)',fontWeight:600}}>Nenhuma pendencia</td></tr>
                : [...pendentes].sort((a,b) => totalAberto(b.id,lancamentos,pagamentos) - totalAberto(a.id,lancamentos,pagamentos)).map(c => {
                    const ab  = totalAberto(c.id, lancamentos, pagamentos);
                    const ult = lancamentos.filter(l => l.cid === c.id).sort((a,b) => b.data.localeCompare(a.data))[0];
                    return (
                      <tr key={c.id}>
                        <td><input type="checkbox" checked={sel.includes(c.id)} onChange={() => toggleSel(c.id)} /></td>
                        <td><div className="client-row"><div className="avatar">{initials(c.nome)}</div>{c.nome}</div></td>
                        <td style={{color:'var(--danger)',fontWeight:700}}>{fmt(ab)}</td>
                        <td>{ult ? formatDate(ult.data) : '-'}</td>
                        <td><button className="btn-quitar" onClick={() => quitar(c.id)}>Quitar</button></td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
        {sel.length > 0 && (
          <div className="bulk-bar">
            <span>{sel.length} cliente(s) · {fmt(totalSel)}</span>
            <button className="btn-primary btn-sm" onClick={quitarSelecionados}>Quitar selecionados</button>
            <button className="btn-ghost btn-sm" onClick={() => { setSel([]); setSelAll(false); }}>Cancelar</button>
          </div>
        )}
      </div>
    </div>
  );
}
