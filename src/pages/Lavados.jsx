import { useState } from 'react';
import { fmt, gerarId } from '../lib/helpers';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { IconPlus } from '../components/Icons';

export default function Lavados({ lavados, lancamentos, salvarDoc }) {
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome]         = useState('');
  const [valor, setValor]       = useState('');

  const salvar = async () => {
    if (!nome.trim()) { alert('Digite o nome do lavado.'); return; }
    if (lavados.find(lv => lv.nome.toLowerCase() === nome.trim().toLowerCase())) { alert('Lavado ja cadastrado.'); return; }
    await salvarDoc('lavados', gerarId(), { nome: nome.trim(), valor: parseFloat(valor) || 0 });
    setNome(''); setValor(''); setShowForm(false);
  };

  const deletar = async (id) => {
    if (!confirm('Remover este lavado?')) return;
    await deleteDoc(doc(db, 'lavados', id));
  };

  const sorted = [...lavados].sort((a,b) => a.nome.localeCompare(b.nome));

  return (
    <div style={{animation:'fadeUp .18s ease'}}>
      <div className="page-header">
        <div><h2 className="page-title">Lavados</h2></div>
        <button className="btn-add" onClick={() => setShowForm(v => !v)}><IconPlus /> Novo lavado</button>
      </div>

      {showForm && (
        <div className="form-card">
          <div className="form-card-title">Novo lavado</div>
          <div className="form-row-2">
            <div className="form-group"><label>Nome</label><input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Stone..." autoCorrect="off" /></div>
            <div className="form-group"><label>Valor padrao (R$)</label><input type="number" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" step="0.01" inputMode="decimal" /></div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={salvar}>Salvar</button>
            <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Lavado</th><th>Valor</th><th>Usos</th><th></th></tr></thead>
            <tbody>
              {sorted.length === 0
                ? <tr className="empty-row"><td colSpan={4}>Nenhum lavado cadastrado</td></tr>
                : sorted.map(lv => {
                    const usos = lancamentos.filter(l => l.lavado === lv.nome).length;
                    return (
                      <tr key={lv.id}>
                        <td><strong>{lv.nome}</strong></td>
                        <td>{fmt(lv.valor)}</td>
                        <td>{usos} uso{usos !== 1 ? 's' : ''}</td>
                        <td>
                          <button className="btn-danger-sm" onClick={() => deletar(lv.id)} disabled={usos > 0} title={usos > 0 ? 'Lavado em uso' : ''}>
                            Remover
                          </button>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
