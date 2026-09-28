import { changeAccount } from "../data/repository";
import { noteItems, localDate } from "../domain";
import { renderNote } from "./note";
import type { AccountData } from "../types";
export async function printNote(
  cid: string,
  ids: string[],
  notify: (message: string) => void,
) {
  // Abrir ainda no clique evita bloqueio de pop-up depois da consulta assíncrona.
  const win = window.open("", "_blank");
  if (!win)
    throw new Error("Permita abrir uma nova aba para visualizar a nota.");
  win.opener = null;
  win.document.body.textContent = "Preparando nota…";
  try {
    let fresh: AccountData | undefined;
    await changeAccount(cid, (data) => {
      fresh = data;
      return [];
    });
    if (!fresh) throw new Error("Conta indisponível.");
    const items = noteItems(fresh.fichas, fresh.pagamentos, ids);
    if (!items.length) {
      win.close();
      notify("As fichas selecionadas já foram pagas. Nenhuma nota foi gerada.");

      return;
    }
    // Incorporar o logo torna a nota independente de novas requisições na aba de impressão.
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
    win.document.open();
    win.document.write(
      renderNote({ client: fresh.client, items, logo, date: localDate() }),
    );
    win.document.close();
    win.document
      .getElementById("print-note")!
      .addEventListener("click", async () => {
        const images = [...win.document.images];
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
        if (images.some((image) => !image.naturalWidth)) {
          win.alert(
            "Não foi possível carregar o logo. Reabra a nota antes de imprimir.",
          );
          return;
        }
        await win.document.fonts.ready;
        win.print();
      });
  } catch (error) {
    win.close();
    throw error;
  }
}
