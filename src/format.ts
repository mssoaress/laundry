import { validDate } from "./domain";
export const fmtC = (n: number) =>
  (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtN = (n: number | string) => Number(n).toLocaleString("pt-BR");
export const formatDate = (value: string) =>
  validDate(value) ? value.split("-").reverse().join("/") : "Data inválida";
export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Verifique a conexão e tente novamente.";
export const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
