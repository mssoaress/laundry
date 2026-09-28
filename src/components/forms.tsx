import { useState } from "react";
import { useApp } from "../hooks/useApp";
import { cents, localDate, moneyInput, validateFicha } from "../domain";
import { fmtC } from "../format";
import type { Client, Ficha } from "../types";
export function ClientForm({
  original,
  onClose,
}: {
  original?: Client;
  onClose: () => void;
}) {
  const { run, operations, busy } = useApp(),
    [nome, setNome] = useState(original?.nome || ""),
    [tel, setTel] = useState(original?.tel || "");
  const nameId = original ? "edit-client-name" : "c-nome",
    phoneId = original ? "edit-client-phone" : "c-tel";
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void run(original ? "editClient" : "createClient", async () => {
          await operations.saveClient(nome, tel, original);
          onClose();
        });
      }}
    >
      <div className="form-group">
        <label htmlFor={nameId}>Nome do cliente</label>
        <input
          id={nameId}
          autoComplete="name"
          maxLength={150}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor={phoneId}>Telefone</label>
        <input
          type="tel"
          id={phoneId}
          autoComplete="tel"
          maxLength={40}
          value={tel}
          onChange={(e) => setTel(e.target.value)}
        />
      </div>
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={busy}>
          {original ? "Salvar alterações" : "Salvar cliente"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={onClose}
          disabled={busy}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
export function FichaForm({
  original,
  initialClient = "",
  onClose,
}: {
  original?: Ficha;
  initialClient?: string;
  onClose: () => void;
}) {
  const { db, run, operations, busy } = useApp(),
    prefix = original ? "e" : "l";
  const historical =
    original &&
    (db.lavados.find((s) => s.id === original.lavadoId) ||
      db.lavados.find((s) => s.nome === original.lavado));
  const [cid, setCid] = useState(original?.cid || initialClient),
    [peca, setPeca] = useState(original?.peca || ""),
    [date, setDate] = useState(original?.data || localDate()),
    [qtd, setQtd] = useState(original ? String(original.qtd) : ""),
    [valor, setValor] = useState(original ? String(original.valor) : ""),
    [serviceId, setServiceId] = useState(historical?.id || "");
  const services = db.lavados
    .filter((s) => !s.arquivado || s.id === historical?.id)
    .sort((a, b) => a.nome.localeCompare(b.nome));
  let preview = "";
  try {
    const amount = moneyInput(valor),
      qty = Number(qtd);
    if (Number.isSafeInteger(qty) && qty > 0)
      preview = `Total: ${fmtC(qty * amount)}`;
  } catch {
    /* O formulário incompleto não tem total. */
  }
  const inputId = (suffix: string) => `${prefix}-${suffix}`;
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void run(original ? "editFicha" : "createFicha", async () => {
          const service = db.lavados.find((s) => s.id === serviceId);
          if (!service || (!original && service.arquivado))
            throw new Error("Selecione um lavado disponível.");
          const data = {
            ...validateFicha({
              peca,
              data: date,
              qtd,
              valor,
              lavado: service.nome,
            }),
            lavadoId: service.id,
          };
          await operations.saveFicha(cid, data, original);
          onClose();
        });
      }}
    >
      {!original && (
        <div className="form-group">
          <label htmlFor="l-cliente">Cliente</label>
          <select
            id="l-cliente"
            value={cid}
            onChange={(e) => setCid(e.target.value)}
          >
            <option value="">Selecione…</option>
            {db.clientes
              .filter((c) => !c.arquivado)
              .sort((a, b) => a.nome.localeCompare(b.nome))
              .map((c) => (
                <option value={c.id} key={c.id}>
                  {c.nome}
                </option>
              ))}
          </select>
        </div>
      )}
      <div className="form-group">
        <label htmlFor={inputId("data")}>Data</label>
        <input
          type="date"
          id={inputId("data")}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor={inputId("peca")}>Peça</label>
        <input
          id={inputId("peca")}
          placeholder="Ex: Shorts, Calças..."
          autoComplete="off"
          value={peca}
          onChange={(e) => setPeca(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor={inputId("lavado")}>Lavado</label>
        <select
          id={inputId("lavado")}
          value={serviceId}
          onChange={(e) => {
            setServiceId(e.target.value);
            const service = db.lavados.find((s) => s.id === e.target.value);
            if (service) setValor((cents(service.valor) / 100).toFixed(2));
          }}
        >
          <option value="">Selecione…</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
              {s.arquivado ? " (arquivado)" : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row-2">
        <div className="form-group">
          <label htmlFor={inputId("qtd")}>Quantidade</label>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            id={inputId("qtd")}
            placeholder="0"
            value={qtd}
            onChange={(e) => setQtd(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor={inputId("valor")}>Valor unit. (R$)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            id={inputId("valor")}
            placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>
      </div>
      <div id={inputId("preview")} className="preview-total">
        {preview}
      </div>
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={busy}>
          {original ? "Salvar" : "Salvar ficha"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={onClose}
          disabled={busy}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
export function PaymentForm({
  cid,
  onClose,
}: {
  cid: string;
  onClose: () => void;
}) {
  const { clientName, account, operations, run, busy } = useApp(),
    [date, setDate] = useState(localDate()),
    [value, setValue] = useState("");
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void run("registerPayment", async () => {
          if (await operations.registerPayment(cid, value, date)) onClose();
        });
      }}
    >
      <div className="form-group">
        <label htmlFor="m-cliente">Cliente</label>
        <input id="m-cliente" disabled value={clientName(cid)} />
      </div>
      <div className="form-group">
        <label htmlFor="m-aberto">Valor em aberto</label>
        <input
          id="m-aberto"
          disabled
          className="input-danger"
          value={fmtC(account(cid).due)}
        />
      </div>
      <p className="help-text">
        Este recebimento ficará disponível para vincular às fichas.
      </p>
      <div className="form-group">
        <label htmlFor="m-data">Data do pagamento</label>
        <input
          type="date"
          id="m-data"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor="m-valor">Valor pago (R$)</label>
        <input
          id="m-valor"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <div className="form-actions">
        <button className="btn-primary" disabled={busy} type="submit">
          Confirmar
        </button>
        <button
          className="btn-ghost"
          disabled={busy}
          type="button"
          onClick={onClose}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
