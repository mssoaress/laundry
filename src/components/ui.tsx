import { useEffect, useRef, useState, type ReactNode } from "react";
import { useApp } from "../hooks/useApp";
import { initials } from "../format";
import type { Client, FichaItem } from "../types";
const paths: Record<string, ReactNode> = {
  check: <path d="m5 12 4 4L19 6" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  wallet: (
    <>
      <rect x="3" y="5" width="18" height="15" rx="3" />
      <path d="M3 9h18m-6 5h3" />
    </>
  ),
  sheets: (
    <>
      <rect x="6" y="3" width="14" height="18" rx="2" />
      <path d="M3 7v12m7-11h6m-6 4h6m-6 4h4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m3 9v-2a5 5 0 0 0-3-4" />
    </>
  ),
  box: <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8M12 13v9" />,
  phone: <path d="m7 3-3 2c-2 5 10 17 15 15l2-3-5-3-2 2-6-6 2-2-3-5Z" />,
  print: (
    <>
      <path d="M7 8V3h10v5M7 17H3V9h18v8h-4" />
      <path d="M7 14h10v7H7zM17 11h1" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  pending: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4m0 4h.01" />
    </>
  ),
  chart: <path d="M18 20V10m-6 10V4M6 20v-6" />,
  wash: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="2" />
      <circle cx="12" cy="13" r="4" />
      <path d="M6 6h.01M10 6h4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
};
export function Icon({
  name,
  className = "ui-icon",
}: {
  name: string;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.sheets}
    </svg>
  );
}
export function Action({
  name,
  id = "",
  children,
  className = "btn-quitar",
}: {
  name: string;
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  const { dispatch, busy } = useApp();
  return (
    <button
      type="button"
      className={className}
      data-action={name}
      data-id={id}
      disabled={busy}
      onClick={() => dispatch(name, id)}
    >
      {children}
    </button>
  );
}
export function Menu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (
        ref.current &&
        (!ref.current.contains(e.target as Node) ||
          (e.target as Element).closest("button"))
      )
        ref.current.open = false;
    };
    document.addEventListener("click", listener);
    return () => document.removeEventListener("click", listener);
  }, []);
  return (
    <details ref={ref} className="action-menu">
      <summary aria-label={label} title={label}>
        <Icon name="more" />
      </summary>
      <div className="action-menu-content">{children}</div>
    </details>
  );
}
export function Metric({
  label,
  value,
  featured = false,
  tone = "",
  hint = "",
}: {
  label: string;
  value: string | number;
  featured?: boolean;
  tone?: string;
  hint?: string;
}) {
  const glyph = /receb|crédito|saldo/i.test(label)
    ? "wallet"
    : /cliente/i.test(label)
      ? "users"
      : /peça/i.test(label)
        ? "box"
        : "sheets";
  return (
    <div className={`metric ${featured ? "featured" : ""}`}>
      <div className="metric-top">
        <div className="lbl">{label}</div>
        <span className="metric-icon">
          <Icon name={glyph} />
        </span>
      </div>
      <div className={`val ${tone}`}>
        {String(value).startsWith("R$") ? (
          <>
            <span className="currency-prefix">R$</span>{" "}
            <span className="currency-number">
              {String(value).replace(/^R\$\s*/, "")}
            </span>
          </>
        ) : (
          value
        )}
      </div>
      {hint && <div className="metric-hint">{hint}</div>}
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-state-title">{children}</div>
    </div>
  );
}
export function ClientCell({ client }: { client: Client }) {
  return (
    <div className="client-row">
      <div className="avatar">{initials(client.nome)}</div>
      {client.nome}
      {client.arquivado ? " (arquivado)" : ""}
    </div>
  );
}
export function Badge({ item }: { item: FichaItem }) {
  return (
    <span
      className={`badge ${item.settled ? "badge-green" : item.paid > 0 ? "badge-amber" : "badge-red"}`}
    >
      {item.status}
    </span>
  );
}
export function Heading({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
export function usePagination(total: number, resetKey = "") {
  const [limit, setLimit] = useState(40);
  useEffect(() => setLimit(40), [resetKey]);
  return {
    limit,
    more:
      total > limit ? (
        <button className="btn-ghost" onClick={() => setLimit((n) => n + 40)}>
          Mostrar mais ({total} registros)
        </button>
      ) : null,
  };
}
export function SelectAll({
  id,
  ids,
  selected,
  onChange,
  label,
}: {
  id: string;
  ids: string[];
  selected: Set<string>;
  onChange: (set: Set<string>) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const count = ids.filter((id) => selected.has(id)).length;
  useEffect(() => {
    if (ref.current)
      ref.current.indeterminate = count > 0 && count < ids.length;
  }, [count, ids.length]);
  return (
    <input
      ref={ref}
      id={id}
      aria-label={label}
      type="checkbox"
      checked={ids.length > 0 && count === ids.length}
      onChange={(e) => {
        const next = new Set(selected);
        for (const id of ids) e.target.checked ? next.add(id) : next.delete(id);
        onChange(next);
      }}
    />
  );
}
export function toggleSelected(set: Set<string>, id: string, checked: boolean) {
  const next = new Set(set);
  if (checked) next.add(id);
  else next.delete(id);
  return next;
}
