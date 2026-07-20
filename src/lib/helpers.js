export const MESES = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export const fmt  = v => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtN = v => Number(v).toLocaleString('pt-BR');
export const mesAtual  = () => String(new Date().getMonth() + 1).padStart(2, '0');
export const anoAtual  = () => String(new Date().getFullYear());
export const hojeISO   = () => new Date().toISOString().split('T')[0];
export const formatDate = iso => iso ? iso.split('-').reverse().join('/') : '';
export const initials   = nome => String(nome).split(' ').map(x => x[0]).filter(Boolean).join('').substring(0, 2).toUpperCase();
export const gerarId    = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

export const totalLanc   = (cid, lancs) => lancs.filter(l => l.cid === cid).reduce((s, l) => s + l.qtd * l.valor, 0);
export const totalPago    = (cid, pgtos) => pgtos.filter(p => p.cid === cid).reduce((s, p) => s + p.valor, 0);
export const totalAberto  = (cid, lancs, pgtos) => Math.max(0, totalLanc(cid, lancs) - totalPago(cid, pgtos));
export const pagosMes     = (pgtos, mes, ano) => pgtos.filter(p => p.data && p.data.substring(5,7) === mes && p.data.substring(0,4) === ano);
export const pagosIntervalo = (pgtos, ini, fim) => pgtos.filter(p => p.data && p.data >= ini && p.data <= fim);
export const pagoDeCliente  = (cid, pgtos) => pgtos.filter(p => p.cid === cid).reduce((s, p) => s + p.valor, 0);
export const lancsMes       = (lancs, mes, ano) => lancs.filter(l => l.data.substring(5,7) === mes && l.data.substring(0,4) === ano);
export const lancsIntervalo = (lancs, ini, fim) => lancs.filter(l => l.data >= ini && l.data <= fim);
export const pecasDeCliente = (cid, lancs) => lancs.filter(l => l.cid === cid).reduce((s, l) => s + l.qtd, 0);
export const fatDeCliente   = (cid, lancs) => lancs.filter(l => l.cid === cid).reduce((s, l) => s + l.qtd * l.valor, 0);

export const semanaAtual = () => {
  const hoje = new Date(), dow = hoje.getDay(), diff = dow === 0 ? -6 : 1 - dow;
  const seg = new Date(hoje); seg.setDate(hoje.getDate() + diff);
  const dom = new Date(seg); dom.setDate(seg.getDate() + 6);
  return { ini: seg.toISOString().substring(0,10), fim: dom.toISOString().substring(0,10) };
};

export const gerarNota = (cliente, fichas, logoUrl) => {
  const totalFat = fichas.reduce((s, l) => s + l.qtd * l.valor, 0);
  const hoje = new Date().toLocaleDateString('pt-BR');
  const linhas = fichas.map(l => {
    const total = l.qtd * l.valor;
    return `<tr>
      <td>${l.qtd} ${l.peca}</td><td>${l.lavado}</td>
      <td class="center">${Number(l.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
      <td class="center bold-blue">${total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
      <td class="center">${formatDate(l.data)}</td>
    </tr>`;
  }).join('');
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nota - ${cliente.nome}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',Arial,sans-serif;font-size:10.5pt;color:#1a2530;background:#fff;padding:14mm 18mm 12mm;max-width:210mm}
.logo-wrap{text-align:center;padding-bottom:10mm;margin-bottom:8mm;border-bottom:2px solid #1565c0}
.logo-wrap img{height:80px;width:auto;object-fit:contain}
.divider{border:none;border-top:1.5px solid #dde6f0;margin:6mm 0}
.divider-blue{border:none;border-top:2px solid #1565c0;margin:6mm 0}
.info-grid{display:grid;grid-template-columns:auto 1fr;gap:3px 16px;margin:6mm 0 8mm}
.info-label{font-weight:700;color:#1565c0;white-space:nowrap}
table{width:100%;border-collapse:collapse;margin:6mm 0}
thead tr{background:#1565c0}
thead th{color:#fff;font-weight:700;font-size:9.5pt;text-transform:uppercase;letter-spacing:.04em;padding:8px 10px;text-align:left}
thead th.center{text-align:center}
tbody tr{border-bottom:1px solid #eef2f7}
tbody tr:last-child{border-bottom:none}
tbody td{padding:7px 10px;font-size:10pt;color:#2d3d4a;vertical-align:middle}
tbody td.center{text-align:center}
tbody td.bold-blue{font-weight:700;color:#1565c0}
tbody tr:nth-child(even) td{background:#f7f9fc}
.total-section{display:flex;justify-content:flex-end;margin-top:6mm;padding-top:5mm;border-top:1.5px solid #dde6f0}
.total-box{text-align:right}
.total-label{font-size:10pt;color:#607d93;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
.total-value{font-size:22pt;font-weight:700;color:#1565c0}
.assin-section{margin-top:12mm}
.assin-label{font-size:9.5pt;color:#1565c0;font-weight:600;margin-bottom:5mm}
.assin-line{border-bottom:1px solid #94a3b8;width:220px;height:20px;display:inline-block}
.footer{margin-top:10mm;padding-top:5mm;border-top:1.5px solid #dde6f0;text-align:center;font-size:8.5pt;color:#8fa5bb;font-style:italic}
.btn-print{display:block;width:100%;margin-top:8mm;padding:13px;background:#1565c0;color:#fff;border:none;border-radius:8px;font-size:13pt;font-weight:700;cursor:pointer;font-family:'Inter',Arial,sans-serif}
@media print{.btn-print{display:none!important}body{padding:10mm 14mm}}
</style></head><body>
<div class="logo-wrap"><img src="${logoUrl}" onerror="this.style.display='none'"></div>
<div class="info-grid">
  <span class="info-label">Contato:</span><span>(83) 981267379 / (83) 981053327</span>
  <span class="info-label">Cliente:</span><span>${cliente.nome}</span>
  <span class="info-label">Data:</span><span>${hoje}</span>
</div>
<hr class="divider-blue">
<table><thead><tr><th>Quantidade</th><th>Lavado</th><th class="center">Valor</th><th class="center">Total</th><th class="center">Data</th></tr></thead>
<tbody>${linhas}</tbody></table>
<hr class="divider">
<div class="total-section"><div class="total-box">
  <div class="total-label">Total R$:</div>
  <div class="total-value">${totalFat.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
</div></div>
<hr class="divider">
<div class="assin-section"><div class="assin-label">Assinatura do Cliente:</div><span class="assin-line"></span></div>
<div class="footer">Lavanderia Emanoel &bull; (83) 981267379 / (83) 981053327</div>
<button class="btn-print" onclick="window.print()">Salvar / Compartilhar PDF</button>
</body></html>`;
};
