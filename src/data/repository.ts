import type {
  AccountOperation,
  Client,
  CollectionName,
  Database,
  Service,
} from "../types";
import type { QuerySnapshot, SnapshotMetadata } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  getDocsFromServer,
  getDocFromServer,
  query,
  where,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
const app = initializeApp({
  apiKey: "AIzaSyDleTdgPI0bvoVN4DYNd6J5yZ9DU15dIn4",
  authDomain: "lavanderia-emanoel.firebaseapp.com",
  projectId: "lavanderia-emanoel",
  storageBucket: "lavanderia-emanoel.firebasestorage.app",
  messagingSenderId: "165346573574",
  appId: "1:165346573574:web:2380641264cd502ccb7287",
});
const firestore = getFirestore(app);
export const newId = () => crypto.randomUUID();
const rows = <K extends CollectionName>(snapshot: QuerySnapshot): Database[K] =>
  snapshot.docs.map((d) => ({ ...d.data(), id: d.id })) as Database[K];
export function subscribe<K extends CollectionName>(
  col: K,
  next: (rows: Database[K], metadata: SnapshotMetadata) => void,
  error: (error: Error) => void,
) {
  return onSnapshot(
    collection(firestore, col),
    { includeMetadataChanges: true },
    (s) => next(rows<K>(s), s.metadata),
    error,
  );
}
export async function createClient(
  data: Pick<Client, "nome" | "tel">,
  id: string = newId(),
) {
  const ref = doc(firestore, "clientes", id);
  await runTransaction(firestore, async (tx) => {
    if ((await tx.get(ref)).exists()) return;
    tx.set(ref, { ...data, id, revision: 0, createdAt: serverTimestamp() });
  });
}
// Toda alteração da conta participa da revisão do cliente. Em caso de concorrência,
// refazemos as consultas no servidor antes de recalcular a operação.
export async function changeAccount(cid: string, operation: AccountOperation) {
  const ref = doc(firestore, "clientes", cid);
  for (let attempt = 0; attempt < 5; attempt++) {
    const before = await getDocFromServer(ref);
    if (!before.exists())
      throw new Error("Cliente não encontrado. Atualize a página.");
    const revision = before.data().revision || 0;
    const [fichas, pagamentos] = await Promise.all(
      ["lancamentos", "pagamentos"].map((col) =>
        getDocsFromServer(
          query(collection(firestore, col), where("cid", "==", cid)),
        ),
      ),
    );
    try {
      return await runTransaction(firestore, async (tx) => {
        const current = await tx.get(ref);
        if (!current.exists() || (current.data().revision || 0) !== revision)
          throw new Error("ACCOUNT_CHANGED");
        const client = { ...current.data(), id: cid } as Client;
        const mutations = operation({
          client,
          fichas: rows<"lancamentos">(fichas),
          pagamentos: rows<"pagamentos">(pagamentos),
        });
        if (!mutations?.length) return;
        for (const mutation of mutations) {
          const target = doc(firestore, mutation.col, mutation.id);
          tx.set(
            target,
            { ...mutation.data, updatedAt: serverTimestamp() },
            { merge: true },
          );
        }
        tx.set(
          ref,
          { revision: revision + 1, updatedAt: serverTimestamp() },
          { merge: true },
        );
      });
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== "ACCOUNT_CHANGED" ||
        attempt === 4
      )
        throw error;
    }
  }
}
export async function saveService(
  data: Pick<Service, "nome" | "valor"> & Partial<Service>,
  id: string | null = null,
) {
  // Nome normalizado é a identidade para impedir duplicatas entre dispositivos.
  const normalized = data.nome
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase("pt-BR");
  const key =
    id ||
    `svc-${Array.from(new TextEncoder().encode(normalized), (b) => b.toString(16).padStart(2, "0")).join("")}`;
  const ref = doc(firestore, "lavados", key);
  await runTransaction(firestore, async (tx) => {
    const snapshot = await tx.get(ref);
    if (!id && snapshot.exists() && !snapshot.data().arquivado)
      throw new Error("Lavado já cadastrado.");
    tx.set(
      ref,
      { ...data, id: key, updatedAt: serverTimestamp() },
      { merge: true },
    );
  });
}
