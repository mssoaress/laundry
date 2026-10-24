import { changeAccount } from "../data/repository";
import { noteItems, localDate } from "../domain";
import { renderNote } from "./note";
import type { AccountData } from "../types";
// Gera a nota dentro do próprio painel. Não depende de pop-up, que navegadores
// e celulares bloqueiam com frequência.
export async function prepareNote(cid: string, ids: string[]) {
  let fresh: AccountData | undefined;
  await changeAccount(cid, (data) => {
    fresh = data;
    return [];
  });
  if (!fresh) throw new Error("Conta indisponível.");
  const items = noteItems(fresh.fichas, fresh.pagamentos, ids);
  if (!items.length) return null;
  // Incorporar o logo deixa a nota independente de novas requisições ao imprimir.
  const logoResponse = await fetch(
    new URL("img/logo-nova-lavanderia.png", location.href),
  );
  if (!logoResponse.ok)
    throw new Error("Não foi possível carregar o logo da nota.");
  const logoBlob = await logoResponse.blob();
  const logo = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("Não foi possível preparar o logo da nota."));
    reader.readAsDataURL(logoBlob);
  });
  return {
    title: `Nota - ${fresh.client.nome}`,
    html: renderNote({
      client: fresh.client,
      items,
      logo,
      date: localDate(),
      embedded: true,
    }),
  };
}
// Aguarda o logo e as fontes do documento da nota antes de abrir a impressão.
export async function printFrame(frame: HTMLIFrameElement, title: string) {
  const win = frame.contentWindow,
    doc = frame.contentDocument;
  if (!win || !doc) throw new Error("A nota ainda está carregando.");
  const images = [...doc.images];
  await Promise.all(
    images.map((image) =>
      image.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          }),
    ),
  );
  if (images.some((image) => !image.naturalWidth))
    throw new Error(
      "Não foi possível carregar o logo. Feche e gere a nota novamente.",
    );
  await doc.fonts.ready;
  // O título da página vira o nome sugerido do PDF.
  const previous = document.title;
  document.title = title;
  try {
    win.focus();
    win.print();
  } finally {
    setTimeout(() => (document.title = previous), 1000);
  }
}
