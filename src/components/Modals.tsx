import { useEffect, useRef, useState, type ReactNode } from "react";
import { useApp } from "../hooks/useApp";
import { noteItems } from "../domain";
import { fmtC, fmtN, formatDate } from "../format";
import { prepareNote, printFrame } from "../services/print";
import { toggleSelected } from "./ui";
import { ClientForm, FichaForm, PaymentForm } from "./forms";
function Modal({
  id,
  title,
  onClose,
  children,
}: {
  id: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { busy } = useApp(),
    ref = useRef<HTMLDivElement>(null),
    busyRef = useRef(busy);
  busyRef.current = busy;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current!;
    const focusable = () => [
      ...root.querySelectorAll<HTMLElement>(
        "button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href]",
      ),
    ];
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const list = focusable(),
          first = list[0],
          last = list.at(-1);
        if (!first) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    root.addEventListener("keydown", key);
    return () => {
      root.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      id={id}
      className="modal-bg"
      style={{ display: "flex" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
      >
        <div className="modal-handle" />
        <div className="modal-title" id={`${id}-title`}>
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}
function NoteSelector({ cid, onClose }: { cid: string; onClose: () => void }) {
  const { account, run, notify, busy, setModal } = useApp(),
    a = account(cid),
    items = noteItems(a.fichas, a.pagamentos),
    [selected, setSelected] = useState(() => new Set(items.map((f) => f.id))),
    total = items
      .filter((f) => selected.has(f.id))
      .reduce((sum, f) => sum + f.due, 0);
  return (
    <>
      <div className="form-actions">
        <button
          id="note-select-all"
          className="btn-ghost"
          onClick={() => setSelected(new Set(items.map((f) => f.id)))}
        >
          Selecionar todas
        </button>
        <button
          id="note-select-none"
          className="btn-ghost"
          onClick={() => setSelected(new Set())}
        >
          Nenhuma
        </button>
      </div>
      <div id="nota-sel-list">
        {items.map((f) => (
          <label className="note-row" key={f.id}>
            <input
              type="checkbox"
              className="chk-nota"
              data-id={f.id}
              checked={selected.has(f.id)}
              onChange={(e) =>
                setSelected(toggleSelected(selected, f.id, e.target.checked))
              }
            />
            <span>
              {fmtN(f.qtd)} × {f.peca} · {f.lavado}
              <small>
                {formatDate(f.data)}
                {f.paid ? ` · Já vinculado: ${fmtC(f.paid)}` : ""}
              </small>
            </span>
            <strong>{fmtC(f.due)}</strong>
          </label>
        ))}
      </div>
      <p>
        Total selecionado: <strong id="nota-sel-total">{fmtC(total)}</strong>
      </p>
      <div className="form-actions">
        <button className="btn-ghost" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button
          className="btn-primary"
          disabled={busy}
          onClick={() => {
            void run("printNote", async () => {
              if (!selected.size)
                throw new Error("Selecione pelo menos uma ficha.");
              const note = await prepareNote(cid, [...selected]);
              if (!note) {
                onClose();
                notify(
                  "As fichas selecionadas já foram pagas. Nenhuma nota foi gerada.",
                );
                return;
              }
              setModal({ kind: "notePreview", ...note });
            });
          }}
        >
          Gerar nota
        </button>
      </div>
    </>
  );
}
function NotePreview({
  html,
  title,
  onClose,
}: {
  html: string;
  title: string;
  onClose: () => void;
}) {
  const { notify } = useApp(),
    frame = useRef<HTMLIFrameElement>(null),
    closeButton = useRef<HTMLButtonElement>(null),
    [loaded, setLoaded] = useState(false),
    [printing, setPrinting] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      id="note-preview"
      className="note-preview"
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-preview-title"
    >
      <div className="note-preview-bar">
        <button
          ref={closeButton}
          type="button"
          className="btn-ghost"
          onClick={onClose}
        >
          Fechar
        </button>
        <div className="note-preview-info">
          <strong id="note-preview-title">{title}</strong>
          <small>
            Na impressão, desative cabeçalhos e rodapés do navegador.
          </small>
        </div>
        <button
          id="note-print"
          type="button"
          className="btn-primary"
          disabled={!loaded || printing}
          onClick={async () => {
            setPrinting(true);
            try {
              await printFrame(frame.current!, title);
            } catch (error) {
              notify(
                error instanceof Error ? error.message : String(error),
                true,
              );
            } finally {
              setPrinting(false);
            }
          }}
        >
          Imprimir / Salvar PDF
        </button>
      </div>
      <iframe
        ref={frame}
        id="note-frame"
        title={title}
        srcDoc={html}
        onLoad={() => {
          const doc = frame.current?.contentDocument,
            win = frame.current?.contentWindow;
          // Depois de imprimir o foco fica na nota; Esc também fecha a partir dela.
          doc?.addEventListener("keydown", (e) => {
            if (e.key === "Escape") closeRef.current();
          });
          // Em telas estreitas, reduz a folha A5 na tela sem alterar a impressão.
          const paper = doc?.querySelector<HTMLElement>(".paper");
          const fit = () => {
            if (!doc || !win || !paper) return;
            const width = paper.offsetWidth + 16;
            doc.documentElement.style.setProperty(
              "--fit",
              String(Math.min(1, win.innerWidth / width)),
            );
          };
          fit();
          win?.addEventListener("resize", fit);
          setLoaded(true);
        }}
      />
    </div>
  );
}
export function Modals() {
  const { modal, setModal } = useApp(),
    close = () => setModal(null);
  if (!modal) return null;
  switch (modal.kind) {
    case "client":
      return (
        <Modal
          key={`client:${modal.client.id}`}
          id="client-edit-bg"
          title="Editar cliente"
          onClose={close}
        >
          <p className="help-text">Mantenha os dados de contato atualizados.</p>
          <ClientForm original={modal.client} onClose={close} />
        </Modal>
      );
    case "ficha":
      return (
        <Modal
          key={`ficha:${modal.ficha.id}`}
          id="modal-edit-bg"
          title="Editar ficha"
          onClose={close}
        >
          <FichaForm original={modal.ficha} onClose={close} />
        </Modal>
      );
    case "payment":
      return (
        <Modal
          key={`payment:${modal.cid}`}
          id="modal-bg"
          title="Registrar pagamento"
          onClose={close}
        >
          <PaymentForm cid={modal.cid} onClose={close} />
        </Modal>
      );
    case "note":
      return (
        <Modal
          key={`note:${modal.cid}`}
          id="nota-sel-bg"
          title="Selecionar fichas não pagas"
          onClose={close}
        >
          <NoteSelector cid={modal.cid} onClose={close} />
        </Modal>
      );
    case "notePreview":
      return (
        <NotePreview
          key="note-preview"
          html={modal.html}
          title={modal.title}
          onClose={close}
        />
      );
  }
}
