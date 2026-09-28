export interface Client {
  id: string;
  nome: string;
  tel?: string;
  arquivado?: boolean;
  revision?: number;
}
export interface Ficha {
  id: string;
  cid: string;
  peca: string;
  qtd: number;
  valor: number;
  lavado: string;
  lavadoId?: string;
  data: string;
  paga?: boolean;
  pagaEm?: string | null;
  cancelada?: boolean;
  canceladaEm?: string;
  createdAtISO?: string;
}
export interface Allocation {
  fid: string;
  centavos: number;
}
export interface Payment {
  id: string;
  cid: string;
  valor: number;
  data: string;
  alocacoes?: Allocation[];
  origem?: string;
  estornado?: boolean;
  estornadoEm?: string;
  motivoEstorno?: string;
}
export interface Service {
  id: string;
  nome: string;
  valor: number;
  arquivado?: boolean;
}
export interface Database {
  clientes: Client[];
  lancamentos: Ficha[];
  pagamentos: Payment[];
  lavados: Service[];
}
export type CollectionName = keyof Database;
export interface AccountData {
  client: Client;
  fichas: Ficha[];
  pagamentos: Payment[];
}
export interface Mutation {
  col: "clientes" | "lancamentos" | "pagamentos";
  id: string;
  data: Partial<Client & Ficha & Payment>;
}
export type AccountOperation = (data: AccountData) => Mutation[];
export interface FichaInput {
  peca: string;
  data: string;
  qtd: string | number;
  valor: string | number;
  lavado: string;
}
export interface FichaItem extends Ficha {
  total: number;
  paid: number;
  due: number;
  settled: boolean;
  status: string;
}
export interface Account {
  fichas: Ficha[];
  pagamentos: Payment[];
  items: Map<string, FichaItem>;
  total: number;
  received: number;
  due: number;
  credit: number;
  available: number;
}
export type Page =
  | "dashboard"
  | "clientes"
  | "cliente-detalhe"
  | "lancamentos"
  | "relatorio"
  | "pendentes"
  | "lavados";
export type DetailTab = "open" | "paid" | "payments" | "history";
export interface DateRange {
  ini: string;
  fim: string;
}
export type ModalState =
  | { kind: "client"; client: Client }
  | { kind: "ficha"; ficha: Ficha }
  | { kind: "payment"; cid: string }
  | { kind: "note"; cid: string }
  | null;
