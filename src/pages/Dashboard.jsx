import { MESES, fmt, fmtN, mesAtual, anoAtual, formatDate, initials,
         totalLanc, totalPago, totalAberto, pagosMes, lancsMes } from '../lib/helpers';

export default function Dashboard({ clientes, lancamentos, pagamentos }) {
  const mes = mesAtual(), ano = anoAtual();
  const totalFat    = pagamentos.reduce((s, p) => s + p.valor, 0);
  const totalAb     = clientes.reduce((s, c) => s + totalAberto(c.id, lancamentos, pagamentos), 0);
  const totalPcs    = lancamentos.reduce((s, l) => s + l.qtd, 0);
  const recebidoMes = pagosMes(pagamentos, mes, ano).reduce((s, p) => s + p.valor, 0);

  const nomeCli = id => { const c = clientes.find(x => x.id === id); return c ? c.nome : '?'; };

  const sortedClientes = [...clientes].sort((a, b) =>
    totalAberto(b.id, lancamentos, pagamentos) - totalAberto(a.id, lancamentos, pagamentos)
  );

  return (
    <div style={{animation:'fadeUp .18s ease'}}>
      <div className="page-header">
        <div>
          <h2 className="page-title">Painel</h2>
          <span className="page-subtitle">
            {new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </span>
        </div>
      </div>

      <div className="metrics">
        <div className="metric"><div className="lbl">Faturamento total</div><div className="val">{fmt(totalFat)}</div></div>
        <div className="metric"><div className="lbl">A receber</div><div className="val danger">{fmt(totalAb)}</div></div>
        <div className="metric"><div className="lbl">Total de pecas</div><div className="val">{fmtN(totalPcs)}</div></div>
        <div className="metric"><div className="lbl">Recebido em {MESES[parseInt(mes)-1]}</div><div className="val success">{fmt(recebidoMes)}</div></div>
      </div>

      <div className="dash-grid">
        <div>
          <div className="section-label">Saldo em aberto</div>
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Cliente</th><th>Recebido</th><th>A receber</th><th>Status</th></tr></thead>
                <tbody>
                  {sortedClientes.filter(c => totalLanc(c.id, lancamentos) > 0 || totalPago(c.id, pagamentos) > 0).length === 0
                    ? <tr className="empty-row"><td colSpan={4}>Nenhuma ficha cadastrada</td></tr>
                    : sortedClientes.filter(c => totalLanc(c.id, lancamentos) > 0 || totalPago(c.id, pagamentos) > 0).map(c => {
                        const pago = totalPago(c.id, pagamentos);
                        const ab   = totalAberto(c.id, lancamentos, pagamentos);
                        const badge = ab === 0 ? 'badge-green' : ab < 200 ? 'badge-amber' : 'badge-red';
                        const badgeTxt = ab === 0 ? 'Em dia' : ab < 200 ? 'Parcial' : 'Aberto';
                        return (
                          <tr key={c.id}>
                            <td><div className="client-row"><div className="avatar">{initials(c.nome)}</div>{c.nome}</div></td>
                            <td>{fmt(pago)}</td>
                            <td>{fmt(ab)}</td>
                            <td><span className={`badge ${badge}`}>{badgeTxt}</span></td>
                          </tr>
                        );
                      })
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <div className="section-label">Ultimas fichas</div>
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Data</th><th>Cliente</th><th>Peca</th><th>Qtd</th><th>Total</th></tr></thead>
                <tbody>
                  {lancamentos.length === 0
                    ? <tr className="empty-row"><td colSpan={5}>Nenhuma ficha</td></tr>
                    : [...lancamentos].sort((a,b) => b.id.localeCompare(a.id)).slice(0,6).map(l => (
                        <tr key={l.id}>
                          <td>{formatDate(l.data)}</td>
                          <td>{nomeCli(l.cid)}</td>
                          <td>{l.peca}</td>
                          <td>{fmtN(l.qtd)}</td>
                          <td>{fmt(l.qtd * l.valor)}</td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
