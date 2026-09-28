import type { Client, FichaItem } from "../types";
import { cents } from "../domain";

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      (
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }) as Record<string, string>
      )[char],
  );
const money = (value: number) =>
  (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = (value: string) => value.split("-").reverse().join("/");
const whatsappIcon = `<svg class="whatsapp-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.5 3.5A11.9 11.9 0 0 0 12 0C5.4 0 0 5.4 0 12c0 2.1.6 4.2 1.6 6L0 24l6.2-1.6c1.8 1 3.8 1.5 5.8 1.5h.1c6.6 0 11.9-5.4 11.9-12a12 12 0 0 0-3.5-8.4ZM12 21.9c-1.8 0-3.6-.5-5.1-1.4l-.4-.2-3.7 1 1-3.6-.3-.4A9.9 9.9 0 1 1 12 21.9Zm5.5-7.4c-.3-.1-1.8-.9-2.1-1s-.5-.1-.7.2-.8 1-1 1.2-.3.2-.6.1a8.1 8.1 0 0 1-4-3.5c-.3-.5.3-.5.9-1.7.1-.2 0-.4 0-.6l-1-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.2 3.3 5.2 4.6 1.9.8 2.7.9 3.7.7.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4s-.4-.2-.7-.4Z"/></svg>`;

// Documento independente: a nota mantém o mesmo desenho no navegador e no PDF.
export function renderNote({
  client,
  items,
  logo,
  date,
}: {
  client: Client;
  items: FichaItem[];
  logo: string;
  date: string;
}) {
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const paid = items.reduce((sum, item) => sum + item.paid, 0);
  const total = items.reduce((sum, item) => sum + item.due, 0);
  const pieces = items.reduce((sum, item) => sum + Number(item.qtd), 0);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nota - ${escapeHtml(client.nome)}</title><style>
  :root{color-scheme:light;--ink:#203c8b;--line:#bfd9ff;--fill:#dceaff;--pale:#f7faff}
  *{box-sizing:border-box}body{margin:0;background:#edf2f9;color:var(--ink);font:10pt Georgia,"Times New Roman",serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .print-toolbar{padding:16px;text-align:center;font:13px Arial,sans-serif;color:#456}button{border:0;border-radius:9px;background:#1565c0;color:white;padding:12px 20px;font:600 14px Arial,sans-serif;cursor:pointer}button:focus-visible{outline:3px solid #80b8ff;outline-offset:3px}.print-toolbar p{margin:9px 0 0}
  .paper{width:148mm;min-height:210mm;margin:0 auto 24px;padding:6mm;display:flex;flex-direction:column;background:#fff;box-shadow:0 4px 30px #173d6815}
  .note-header{text-align:center;padding:8mm 0 7mm;break-inside:avoid}.note-logo{width:42mm;height:22mm;object-fit:contain}.client-line{display:flex;gap:2mm;align-items:baseline;border-bottom:1px solid var(--line);margin:0 0 2.5mm;font-size:12pt;overflow-wrap:anywhere}.client-line>strong{flex-shrink:0}.client-name{color:#20345f;font-size:11pt}.issue-line{display:flex;justify-content:space-between;gap:3mm;font:8pt Arial,sans-serif;margin:0 0 3mm;color:#55709a;flex-wrap:wrap}
  table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:8.5pt}thead{display:table-header-group}th{background:var(--fill);font-weight:bold;text-align:left}th,td{padding:2.7mm 1.8mm;border-right:1px solid var(--line);border-bottom:1px solid var(--line);vertical-align:middle;overflow-wrap:anywhere}th:first-child,td:first-child{border-left:1px solid var(--line)}th{border-top:1px solid var(--line)}th:first-child{border-top-left-radius:4mm}th:last-child{border-top-right-radius:4mm}tbody tr:last-child td:first-child{border-bottom-left-radius:4mm}tbody tr:last-child td:last-child{border-bottom-right-radius:4mm}tbody tr:nth-child(even){background:var(--pale)}tr{break-inside:avoid}td{color:#233753}td small{display:block;margin-top:1mm;font:7pt/1.4 Arial,sans-serif;color:#637899}.number{text-align:right;white-space:nowrap;overflow-wrap:normal}.quantity{text-align:center}.date{white-space:nowrap;font-size:7.8pt}.value{font-size:8pt;font-weight:bold}.value small{white-space:normal;font-weight:normal}
  .totals{margin:3mm 0 4mm;display:flex;justify-content:flex-end;break-inside:avoid}.totals-box{min-width:61mm;border:1px solid var(--line);border-radius:3mm;overflow:hidden;font:8.5pt Arial,sans-serif}.totals-row{display:flex;justify-content:space-between;gap:5mm;padding:2mm 3mm}.total{background:var(--fill);font-weight:bold;font-size:10pt}.total strong{white-space:nowrap}
  .annotations{border:1px solid var(--line);border-radius:3mm;overflow:hidden;break-inside:avoid;margin-top:1mm}.section-title{margin:0;font-size:10pt;background:var(--fill);padding:2.3mm 3mm;border-bottom:1px solid var(--line)}.writing-line{height:7mm;border-bottom:1px solid var(--line)}.writing-line:nth-child(odd){background:var(--pale)}.writing-line:last-child{border:0}.extra{break-inside:avoid;margin-top:3mm}.extra h2{font-size:10pt;margin:0 0 1mm}.extra p{font:7.5pt/1.5 Arial,sans-serif;color:#5e7393;margin:1mm 0 0}.extra .writing-line{background:white;height:6mm;border-bottom:1px solid var(--line)}
  .note-footer{margin-top:auto;padding-top:6mm;break-inside:avoid;text-align:center}.contacts{display:flex;justify-content:center;flex-wrap:wrap;gap:2mm 5mm;padding-bottom:3mm}.contacts a{display:inline-flex;align-items:center;gap:1.5mm;color:var(--ink);text-decoration:none;font:bold 8.5pt Arial,sans-serif}.whatsapp-icon{width:3.7mm;height:3.7mm;flex-shrink:0}.verse{border-top:1px solid var(--line);padding-top:2mm;margin:0;font-size:9pt;font-style:italic;font-weight:bold}
  .compact .note-header{padding:2mm 0}.compact .note-logo{height:18mm}.compact th,.compact td{padding-top:.9mm;padding-bottom:.9mm}.compact .annotations .writing-line{height:5mm}.compact .totals-row{padding-top:1.5mm;padding-bottom:1.5mm}.compact .note-footer{padding-top:3mm}.compact .extra .writing-line:last-child{display:none}
  @page{size:A5 portrait;margin:6mm}
  @media print{body{background:white}.print-toolbar{display:none}.paper{width:auto;min-height:198mm;margin:0;padding:0;box-shadow:none}.note-header{padding-top:8mm}a{color:inherit}}
  @media screen and (max-width:580px){body{overflow-x:auto}.print-toolbar{position:sticky;left:0;width:100vw}.paper{margin-left:8px;margin-right:8px}}
  </style></head><body><div class="print-toolbar"><button id="print-note" type="button">Imprimir / Salvar PDF</button><p>Modelo A5. Na impressão, desative os cabeçalhos e rodapés do navegador.</p></div><main class="paper${items.length > 3 ? " compact" : ""}"><header class="note-header"><img class="note-logo" src="${escapeHtml(logo)}" alt="Lavanderia Emanoel"></header><div class="client-line"><strong>Cliente:</strong><span class="client-name">${escapeHtml(client.nome)}</span></div><div class="issue-line"><span>Nota de serviços · Emissão: ${dateLabel(date)}</span><span>${items.length} ficha(s) · ${pieces.toLocaleString("pt-BR")} peças</span></div>
  <table aria-label="Fichas da nota"><colgroup><col style="width:26%"><col style="width:23%"><col style="width:13%"><col style="width:17%"><col style="width:21%"></colgroup><thead><tr><th>Descrição:</th><th>Lavado:</th><th class="quantity">Qtd.:</th><th>Data:</th><th class="number">Valor:</th></tr></thead><tbody>${items.map((f) => `<tr><td>${escapeHtml(f.peca)}<small>Unitário: ${money(cents(f.valor))}</small></td><td>${escapeHtml(f.lavado)}</td><td class="quantity">${Number(f.qtd).toLocaleString("pt-BR")}</td><td class="date">${dateLabel(f.data)}</td><td class="number value">${money(f.due)}${f.paid > 0 ? `<small>Total: ${money(f.total)}<br>Pago: ${money(f.paid)}</small>` : ""}</td></tr>`).join("")}</tbody></table>
  <div class="totals"><div class="totals-box">${paid > 0 ? `<div class="totals-row"><span>Total das fichas</span><span>${money(subtotal)}</span></div><div class="totals-row"><span>Pagamentos vinculados</span><span>- ${money(paid)}</span></div>` : ""}<div class="totals-row total"><span>Total a pagar</span><strong>${money(total)}</strong></div></div></div>
  <section class="annotations"><h2 class="section-title">Anotações:</h2>${'<div class="writing-line"></div>'.repeat(items.length > 3 ? 2 : 5)}</section><section class="extra"><h2>Informações Extras:</h2><p>Esta nota reúne as fichas em aberto selecionadas.${paid > 0 ? " Os valores já vinculados foram descontados." : ""}</p><div class="writing-line"></div><div class="writing-line"></div></section><footer class="note-footer"><div class="contacts"><a href="https://wa.me/5583981267379" aria-label="WhatsApp (83) 98126-7379">${whatsappIcon}(83) 98126-7379</a><a href="https://wa.me/5583981053327" aria-label="WhatsApp (83) 98105-3327">${whatsappIcon}(83) 98105-3327</a></div><p class="verse">Samuel 7.12: Até aqui nos ajudou o Senhor!</p></footer></main></body></html>`;
}
