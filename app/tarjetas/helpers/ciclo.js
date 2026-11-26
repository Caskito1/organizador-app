// tarjetas/helpers/ciclo.js
// 6.0 — Modelo PURO de la tarjeta: el ciclo (unidad de la tarjeta, no el mes).
//
// Plan: PROPUESTA-ETAPA-6.md §10.4. Sin SDK de Firebase y sin alias @/… para
// poder testearlo con node --test sin emulador. Reusa `aDate` (puro) de
// gastos/helpers/dateHelpers.js para el duck-typing de Timestamp.
//
// El `cicloKey` es "YYYY-MM" del VENCIMIENTO (p. ej. "2026-12" = «vence 30/12»).
// El rango de compras lo fija el CIERRE: [diaCierre+1 del mes anterior,
// diaCierre+1 del mes de cierre) — semiabierto, el día de cierre incluido.
//
// Enmienda (ii): el mes del VENCIMIENTO se deriva del cierre:
//   diaVencimiento > diaCierre  → mismo mes del cierre
//   diaVencimiento <= diaCierre → mes siguiente al del cierre
// OCA es 18/30 (mismo mes). Si no se pasa diaVencimiento, se asume el mismo
// mes (comportamiento OCA), para no romper a los consumidores que aún no lo
// informan.

import { aDate } from "../../gastos/helpers/dateHelpers.js";

export const MES_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

// OCA y el resto de v1: el día de cierre debe existir en todos los meses
// (1..28) para que diaCierre+1 sea un borde exacto. 29..31 queda fuera de v1.
function diaCierreValido(dia) {
  return Number.isInteger(dia) && dia >= 1 && dia <= 28;
}

// ¿diaVencimiento cae en el MISMO mes que el cierre? (enmienda ii)
// Sin diaVencimiento → mismo mes (OCA por defecto).
function venceEnMismoMes(diaCierre, diaVencimiento) {
  if (!Number.isInteger(diaVencimiento)) return true;
  return diaVencimiento > diaCierre;
}

export function esCicloValido(clave) {
  return typeof clave === "string" && MES_RE.test(clave);
}

// 'YYYY-MM' → mes absoluto (anio*12 + mes0) o null. Aritmética de meses.
function indiceDeClave(clave) {
  if (!esCicloValido(clave)) return null;
  const [anio, mes] = clave.split("-").map(Number);
  return anio * 12 + (mes - 1);
}

// mes absoluto → 'YYYY-MM'. Math.floor cubre índices negativos (años < 0).
function claveDeIndice(indice) {
  const anio = Math.floor(indice / 12);
  const mes = indice - anio * 12 + 1;
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

// Fecha (Timestamp|Date|string) → cicloKey del VENCIMIENTO al que pertenece.
export function cicloDeFecha(fecha, diaCierre, diaVencimiento) {
  const d = aDate(fecha);
  if (!d || !diaCierreValido(diaCierre)) return null;

  const indiceFecha = d.getFullYear() * 12 + d.getMonth(); // mes 0-based
  const cierraEsteMes = d.getDate() <= diaCierre;
  const indiceCierre = cierraEsteMes ? indiceFecha : indiceFecha + 1;
  const indiceVenc = venceEnMismoMes(diaCierre, diaVencimiento)
    ? indiceCierre
    : indiceCierre + 1;

  return claveDeIndice(indiceVenc);
}

// 'YYYY-MM' + delta (meses) → 'YYYY-MM'.
export function sumarCiclos(clave, delta) {
  const indice = indiceDeClave(clave);
  if (indice === null || !Number.isInteger(delta)) return null;
  return claveDeIndice(indice + delta);
}

// b - a en meses (puede ser negativo).
export function ciclosEntre(a, b) {
  const ia = indiceDeClave(a);
  const ib = indiceDeClave(b);
  if (ia === null || ib === null) return null;
  return ib - ia;
}

// Rango de COMPRAS del ciclo, SEMIABIERTO [desde, hasta).
// Para "2026-12", diaCierre 18 → [19/11/2026 00:00, 19/12/2026 00:00).
export function rangoCiclo(clave, diaCierre, diaVencimiento) {
  const indiceVenc = indiceDeClave(clave);
  if (indiceVenc === null || !diaCierreValido(diaCierre)) return null;

  const indiceCierre = venceEnMismoMes(diaCierre, diaVencimiento)
    ? indiceVenc
    : indiceVenc - 1;
  const anioCierre = Math.floor(indiceCierre / 12);
  const mesCierre0 = indiceCierre - anioCierre * 12; // 0-based

  // Borde del mes de cierre y del anterior: día diaCierre+1 a las 00:00 local.
  const desde = new Date(anioCierre, mesCierre0 - 1, diaCierre + 1);
  const hasta = new Date(anioCierre, mesCierre0, diaCierre + 1);

  return { desde, hasta };
}

// ¿La fecha cae en el ciclo? (desde <= fecha < hasta)
export function fechaEnCiclo(fecha, clave, diaCierre, diaVencimiento) {
  const d = aDate(fecha);
  const rango = rangoCiclo(clave, diaCierre, diaVencimiento);
  if (!d || !rango) return false;
  return d >= rango.desde && d < rango.hasta;
}

// Vencimiento del ciclo: día diaVencimiento del mes del cicloKey.
// SOLO display: tolera el rollover de mes (30/02 → marzo). No participa del
// rango de compras (eso lo fija el cierre).
export function vencimientoDeCiclo(clave, diaVencimiento) {
  if (!esCicloValido(clave)) return null;
  const [anio, mes] = clave.split("-").map(Number);
  const dia =
    Number.isInteger(diaVencimiento) && diaVencimiento >= 1 && diaVencimiento <= 31
      ? diaVencimiento
      : 30;
  const fecha = new Date(anio, mes - 1, dia);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

// "2026-12" → "12/2026" (etiqueta corta; el "Resumen · vence 30/12" lo arma la UI).
export function etiquetaCiclo(clave) {
  if (!esCicloValido(clave)) return null;
  const [anio, mes] = clave.split("-").map(Number);
  return `${String(mes).padStart(2, "0")}/${anio}`;
}
