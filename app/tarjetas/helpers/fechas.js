// tarjetas/helpers/fechas.js
// 6.2 — Rótulos de fechas del ciclo (PURO, sin SDK).
// Plan: PROPUESTA-ETAPA-6.md §12.4. El `cicloKey` es "YYYY-MM" del VENCIMIENTO.

import { rangoCiclo, vencimientoDeCiclo } from "./ciclo.js";

const CICLO_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

function dos(n) {
  return String(n).padStart(2, "0");
}

function ddmm(fecha) {
  return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}`;
}

// "YYYY-MM" → Date del día 1 del mes (para MonthNavigator).
export function mesDeCiclo(cicloKey) {
  const match = typeof cicloKey === "string" ? CICLO_RE.exec(cicloKey) : null;
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}

// Date → "YYYY-MM" local.
export function claveDeMes(fecha) {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) return null;
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}`;
}

// "vence 30/12"
export function rotuloVencimiento(cicloKey, diaVencimiento) {
  const fecha = vencimientoDeCiclo(cicloKey, diaVencimiento);
  return fecha ? `vence ${ddmm(fecha)}` : "";
}

// "19/11 al 18/12" (el rango de compras es semiabierto: [desde, hasta)).
export function rotuloRango(cicloKey, diaCierre, diaVencimiento) {
  const rango = rangoCiclo(cicloKey, diaCierre, diaVencimiento);
  if (!rango) return "";
  const ultimo = new Date(rango.hasta.getTime() - 24 * 60 * 60 * 1000);
  return `${ddmm(rango.desde)} al ${ddmm(ultimo)}`;
}
