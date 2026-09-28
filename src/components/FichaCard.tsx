import { useApp } from "../hooks/useApp";
import { fmtC, fmtN, formatDate } from "../format";
import type { FichaItem } from "../types";
import { Action, Badge, Icon, Menu } from "./ui";
export function FichaCard({
  item,
  detail = false,
}: {
  item: FichaItem;
  detail?: boolean;
}) {
  const { clientName } = useApp();
  return (
    <article className={`lanc-card ${item.settled ? "is-paid" : ""}`}>
      <div className="ficha-symbol">
        <Icon name={item.settled ? "check" : "sheets"} />
      </div>
      <div className="lanc-card-left">
        <div className="ficha-heading">
          <h3 className="lanc-card-peca">{item.peca}</h3>
          <Badge item={item} />
        </div>
        <div className="lanc-card-meta">
          {!detail && `${clientName(item.cid)} · `}
          {fmtN(item.qtd)} peças <span>·</span> {item.lavado} <span>·</span>{" "}
          {formatDate(item.data)}
        </div>
        {item.paid > 0 && !item.settled && (
          <div className="partial-info">
            Já vinculado {fmtC(item.paid)} · Restante {fmtC(item.due)}
          </div>
        )}
      </div>
      <div className="lanc-card-right">
        <strong className="lanc-card-total">{fmtC(item.total)}</strong>
        <div className="lanc-card-btns">
          {item.settled ? (
            <span className="paid-label">
              <Icon name="check" /> Paga
            </span>
          ) : (
            <Action name="payFicha" id={item.id}>
              <Icon name="check" /> Marcar como paga
            </Action>
          )}
          <Menu label={`Ações da ficha ${item.peca}`}>
            {(item.settled || item.paid > 0) && (
              <Action name="unmarkFicha" id={item.id} className="menu-item">
                {item.settled ? "Desmarcar paga" : "Desvincular pagamento"}
              </Action>
            )}
            <Action name="editFicha" id={item.id} className="menu-item">
              Editar ficha
            </Action>
            <Action
              name="deleteFicha"
              id={item.id}
              className="menu-item danger"
            >
              Cancelar ficha
            </Action>
          </Menu>
        </div>
      </div>
    </article>
  );
}
