import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { subscribe, newId } from "../data/repository";
import { buildAccounts, createOperations } from "../services/operations";
import { localDate, noteItems, statement } from "../domain";
import { errorMessage } from "../format";
import type { Account, Database, ModalState, Page } from "../types";
const emptyDb: Database = {
  clientes: [],
  lancamentos: [],
  pagamentos: [],
  lavados: [],
};
export function useAppModel() {
  const [db, setDb] = useState<Database>(emptyDb),
    dbRef = useRef(db);
  dbRef.current = db;
  const [page, setPage] = useState<Page>("dashboard"),
    [clientId, setClientId] = useState("");
  const [ready, setReady] = useState(false),
    [loading, setLoading] = useState(true),
    [connection, setConnection] = useState("Conectando…"),
    [reconnectKey, setReconnectKey] = useState(0);
  const [notice, setNotice] = useState<{
      message: string;
      error: boolean;
    } | null>(null),
    [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalState>(null),
    [newFichaClient, setNewFichaClient] = useState<string | null>(null);
  const pending = useRef(new Set<string>()),
    commands = useRef(new Map<string, { id: string; signature: string }>());
  const notify = useCallback(
    (message: string, error = false) => setNotice({ message, error }),
    [],
  );
  useEffect(() => {
    if (!notice || notice.error) return;
    const id = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(id);
  }, [notice]);
  const commandId = useCallback((key: string, signature: string) => {
    const old = commands.current.get(key);
    if (old?.signature === signature) return old.id;
    const id = newId();
    commands.current.set(key, { id, signature });
    return id;
  }, []);
  const operations = useMemo(
    () => createOperations(() => dbRef.current, commandId, notify),
    [commandId, notify],
  );
  const run = useCallback(
    async (key: string, fn: () => Promise<unknown>) => {
      if (pending.current.has(key)) return false;
      pending.current.add(key);
      setBusy(true);
      try {
        await fn();
        commands.current.delete(key);
        return true;
      } catch (error) {
        notify(
          errorMessage(error) === "ACCOUNT_CHANGED"
            ? "Os dados mudaram em outro dispositivo. Confira e tente novamente."
            : `Não foi possível concluir: ${errorMessage(error)}`,
          true,
        );
        return false;
      } finally {
        pending.current.delete(key);
        setBusy(pending.current.size > 0);
      }
    },
    [notify],
  );
  useEffect(() => {
    let alive = true;
    const loaded = new Set<string>(),
      cache = new Map<string, boolean>();
    setLoading(true);
    const timeout = setTimeout(() => {
      if (alive) {
        setLoading(false);
        notify(
          "A conexão está demorando. Verifique a internet e use Reconectar.",
          true,
        );
      }
    }, 12000);
    const subscriptions = (Object.keys(emptyDb) as (keyof Database)[]).map(
      (col) =>
        subscribe(
          col,
          (rows, metadata) => {
            if (!alive) return;
            setDb((prev) => ({ ...prev, [col]: rows }));
            loaded.add(col);
            cache.set(col, metadata.fromCache);
            setConnection(
              [...cache.values()].some(Boolean)
                ? "Dados em cache · aguardando sincronização"
                : "Sincronizado",
            );
            if (loaded.size === 4) {
              clearTimeout(timeout);
              setReady(true);
              setLoading(false);
            }
          },
          (error) => {
            if (alive) {
              clearTimeout(timeout);
              setLoading(false);
              setConnection("Falha na conexão");
              notify(
                `Falha ao carregar ${col}: ${errorMessage(error)}. Use Reconectar.`,
                true,
              );
            }
          },
        ),
    );
    return () => {
      alive = false;
      clearTimeout(timeout);
      subscriptions.forEach((unsubscribe) => unsubscribe());
    };
  }, [reconnectKey, notify]);
  useEffect(() => {
    document.body.classList.toggle("saving", busy);
    return () => document.body.classList.remove("saving");
  }, [busy]);
  const accounts = useMemo(() => buildAccounts(db), [db]);
  const account = (cid: string): Account =>
    accounts.get(cid) || { ...statement([], []), fichas: [], pagamentos: [] };
  const navigate = (next: Page) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const detail = (id: string) => {
    setClientId(id);
    navigate("cliente-detalhe");
  };
  const newFicha = (cid = "") => {
    setNewFichaClient(cid);
    navigate("lancamentos");
  };
  const clientName = (id: string) =>
    db.clientes.find((c) => c.id === id)?.nome || "Cliente indisponível";
  const dispatch = (name: string, id: string) => {
    const ficha = db.lancamentos.find((f) => f.id === id),
      client = db.clientes.find((c) => c.id === id);
    switch (name) {
      case "detail":
        detail(id);
        return;
      case "newFicha":
        newFicha(id);
        return;
      case "payment":
        setModal({ kind: "payment", cid: id });
        return;
      case "editClient":
        if (client) setModal({ kind: "client", client: { ...client } });
        return;
      case "editFicha":
        if (ficha) setModal({ kind: "ficha", ficha: { ...ficha } });
        return;
      case "selectNote":
        if (!noteItems(account(id).fichas, account(id).pagamentos).length) {
          notify("Não há fichas não pagas para imprimir.");
          return;
        }
        setModal({ kind: "note", cid: id });
        return;
      case "archiveClient":
        void run(`${name}:${id}`, () => operations.archiveClient(id));
        return;
      case "deleteFicha":
        void run(`${name}:${id}`, () => operations.cancelFicha(id));
        return;
      case "restoreFicha":
        void run(`${name}:${id}`, () => operations.restoreFicha(id));
        return;
      case "unmarkFicha":
        void run(`${name}:${id}`, () => operations.unmarkFicha(id));
        return;
      case "payFicha":
        if (ficha)
          void run(`${name}:${id}`, () =>
            operations.markGroups([{ cid: ficha.cid, ids: [id] }]),
          );
        return;
      case "settle":
        void run(`${name}:${id}`, () =>
          operations.markGroups([
            { cid: id, ids: [...account(id).items.keys()] },
          ]),
        );
        return;
      case "reverse":
        void run(`${name}:${id}`, () => operations.reversePayment(id));
        return;
      case "archiveService":
        void run(`${name}:${id}`, () => operations.archiveService(id));
        return;
      case "editService": {
        const s = db.lavados.find((s) => s.id === id);
        if (!s) return;
        const value = prompt(
          "Novo valor padrão (as fichas existentes mantêm o valor):",
          Number(s.valor).toFixed(2),
        );
        if (value !== null)
          void run(`${name}:${id}`, () =>
            operations.saveService(s.nome, value, s),
          );
        return;
      }
    }
  };
  const exportData = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { exportadoEm: new Date().toISOString(), ...db },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `lavanderia-backup-${localDate()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return {
    db,
    page,
    clientId,
    ready,
    loading,
    connection,
    notice,
    busy,
    modal,
    newFichaClient,
    setNewFichaClient,
    setModal,
    account,
    accounts,
    clientName,
    navigate,
    detail,
    newFicha,
    dispatch,
    operations,
    run,
    notify,
    dismiss: () => setNotice(null),
    reconnect: () => {
      setNotice(null);
      setReconnectKey((k) => k + 1);
    },
    exportData,
  };
}
type AppModel = ReturnType<typeof useAppModel>;
const AppContext = createContext<AppModel | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const model = useAppModel();
  return <AppContext.Provider value={model}>{children}</AppContext.Provider>;
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("AppProvider indisponível");
  return value;
}
