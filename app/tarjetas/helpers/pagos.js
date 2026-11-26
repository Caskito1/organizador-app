// tarjetas/helpers/pagos.js
// 6.0 — Modelo PURO de la tarjeta: pagos del resumen (A-1).
//
// Plan: PROPUESTA-ETAPA-6.md §10.9 + enmienda §9.1. UN pago por ciclo POR
// MONEDA (objeto, no lista; sin parciales):
//   pagos = { [cicloKey]: { UYU?: {monto, fecha}, USD?: {monto, fecha} } }
//
// `pagosTarjetaDelMes` es el input de caja del balance (§14.7): SOLO UYU y por
// la FECHA del pago (no por la clave del ciclo). Se define y testea en 6.0, se
// consume en 6.4.

import { aDate } from "../../gastos/helpers/dateHelpers.js";

// Pago del ciclo/moneda, o null.
export function pagoDeCiclo(pagos, cicloKey, moneda) {
  const pago = pagos?.[cicloKey]?.[moneda];
  if (!pago) return null;
  return { monto: Number(pago.monto ?? 0), fecha: pago.fecha ?? null };
}

// Σ de pagos en UYU con `fecha` en [desde, hasta). Recorre por fecha real del
// pago (atribución al mes de caja), no por la clave del ciclo.
export function pagosTarjetaDelMes({ pagos, desde, hasta } = {}) {
  if (!desde || !hasta) return 0;

  let total = 0;
  for (const ciclo of Object.values(pagos ?? {})) {
    const pago = ciclo?.UYU;
    if (!pago) continue;

    const fecha = aDate(pago.fecha);
    if (!fecha) continue;
    if (fecha >= desde && fecha < hasta) total += Number(pago.monto ?? 0);
  }
  return total;
}

// ¿El pago cubre el "a pagar" del ciclo en cada moneda con deuda?
export function pagoCubreCiclo(pagos, cicloKey, aPagar) {
  for (const moneda of ["UYU", "USD"]) {
    const debido = Number(aPagar?.[moneda] ?? 0);
    if (debido <= 0) continue;

    const pago = pagoDeCiclo(pagos, cicloKey, moneda);
    if (!pago || Number(pago.monto ?? 0) < debido) return false;
  }
  return true;
}

// ¿Hay un pago > 0 registrado para esa moneda en el ciclo?
export function pagoRegistrado(pagos, cicloKey, moneda) {
  const pago = pagoDeCiclo(pagos, cicloKey, moneda);
  return !!pago && Number(pago.monto ?? 0) > 0;
}

// Etiqueta corta de display (monto · dd/mm), opcional.
export function etiquetaPago(pago) {
  if (!pago) return null;

  const monto = Number(pago.monto ?? 0);
  const fecha = aDate(pago.fecha);
  if (!fecha) return `${monto}`;

  const dd = String(fecha.getDate()).padStart(2, "0");
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  return `${monto} · ${dd}/${mm}`;
}
