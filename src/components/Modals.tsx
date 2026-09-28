import { useEffect, useRef, useState, type ReactNode } from "react";
import { useApp } from "../hooks/useApp";
import { noteItems } from "../domain";
import { fmtC, fmtN, formatDate } from "../format";
import { printNote } from "../services/print";
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
  const { account, run, notify, busy } = useApp(),
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
              await printNote(cid, [...selected], notify);
              onClose();
            });
          }}
        >
          Gerar nota
        </button>
      </div>
    </>
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
  }
}
