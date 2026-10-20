import { useState } from "react";
import { useApp } from "../hooks/useApp";
import { cents } from "../domain";
import { fmtC } from "../format";
import { Action, Heading, Icon } from "../components/ui";
export function Services() {
  const { db, operations, run, busy } = useApp(),
    [creating, setCreating] = useState(false),
    [name, setName] = useState(""),
    [value, setValue] = useState("");
  const active = db.lancamentos.filter((f) => !f.cancelada);
  // Fichas antigas sem lavadoId são reconhecidas pelo nome.
  const usages = (id: string, nome: string) =>
    active.filter((f) => (f.lavadoId ? f.lavadoId === id : f.lavado === nome))
      .length;
  const services = [...db.lavados].sort((a, b) => a.nome.localeCompare(b.nome));
  return (
    <>
      <Heading
        eyebrow="CATÁLOGO DE SERVIÇOS"
        title="Lavados"
        subtitle="Seus serviços e valores de referência."
      >
        <button className="btn-add" onClick={() => setCreating(!creating)}>
          <Icon name="plus" />
          Novo lavado
        </button>
      </Heading>
      {creating && (
        <form
          noValidate
          id="form-lavado"
          className="form-card"
          onSubmit={(e) => {
            e.preventDefault();
            void run("saveService", async () => {
              await operations.saveService(name, value);
              setName("");
              setValue("");
              setCreating(false);
            });
          }}
        >
          <div className="form-card-title">Novo lavado</div>
          <div className="form-group">
            <label htmlFor="lv-nome">Nome</label>
            <input
              id="lv-nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="lv-valor">Valor padrão (R$)</label>
            <input
              id="lv-valor"
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={busy}>
              Salvar lavado
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => setCreating(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lavado</th>
                <th>Valor</th>
                <th>Usos</th>
                <th />
              </tr>
            </thead>
            <tbody id="tbl-lavados">
              {services.length ? (
                services.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.nome}
                      {s.arquivado ? " (arquivado)" : ""}
                    </td>
                    <td>{fmtC(cents(s.valor))}</td>
                    <td>{usages(s.id, s.nome)}</td>
                    <td>
                      <Action
                        name="editService"
                        id={s.id}
                        className="btn-edit-sm"
                      >
                        Preço
                      </Action>
                      <Action
                        name="archiveService"
                        id={s.id}
                        className="btn-danger-sm"
                      >
                        {s.arquivado ? "Restaurar" : "Arquivar"}
                      </Action>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>Cadastre o primeiro lavado</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
