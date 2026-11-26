// tarjetas/helpers/cuota.js
// 6.0 — Modelo PURO de la tarjeta: cuota de una compra frente al ciclo.
//
// Plan: PROPUESTA-ETAPA-6.md §10.5. NADA de cuota actual persistida: todo se
// DERIVA de `fecha` + `cuotasTotal` (editar fecha/cuotas re-deriva sin migrar,
// §1.3). Montos SIEMPRE enteros: `floor(monto/total)` y la última cuota absorbe
// el resto, así la suma es exacta y no aparecen centavos.
//
// Una compra con cuota 1 en el ciclo de su fecha: la cuota n cae en
// cicloCompra + (n-1) ciclos.

import { aDate } from "../../gastos/helpers/dateHelpers.js";
import { cicloDeFecha, ciclosEntre, sumarCiclos } from "./ciclo.js";

function cuotasTotalDe(compra) {
  return Math.max(1, Math.trunc(Number(compra?.cuotasTotal ?? 1)));
}

function montoDe(compra) {
  return Number(compra?.monto ?? 0);
}

// Monto entero de la cuota n (1..total). Base floor; la última absorbe el resto.
export function montoCuotaDe(compra, n) {
  const total = cuotasTotalDe(compra);
  if (!Number.isInteger(n) || n < 1 || n > total) return 0;

  const base = Math.floor(montoDe(compra) / total);
  return n === total ? montoDe(compra) - base * (total - 1) : base;
}

// Cuota de la compra en un ciclo, o null si no cae en él.
export function cuotaEnCiclo(compra, cicloKey, diaCierre, diaVencimiento) {
  const fecha = aDate(compra?.fecha);
  if (!fecha) return null;

  const cicloCompra = cicloDeFecha(fecha, diaCierre, diaVencimiento);
  if (!cicloCompra) return null;

  const total = cuotasTotalDe(compra);
  const diff = ciclosEntre(cicloCompra, cicloKey);
  if (diff === null) return null;

  const n = diff + 1;
  if (n < 1 || n > total) return null;

  return {
    n,
    total,
    monto: montoCuotaDe(compra, n),
    esUltima: n === total,
  };
}

export function cuotaActualDe(compra, cicloKey, diaCierre, diaVencimiento) {
  return cuotaEnCiclo(compra, cicloKey, diaCierre, diaVencimiento)?.n ?? null;
}

// "quedan N" de la UI: cuotas DESPUÉS de la del ciclo.
export function cuotasRestantesDe(compra, cicloKey, diaCierre, diaVencimiento) {
  const c = cuotaEnCiclo(compra, cicloKey, diaCierre, diaVencimiento);
  return c ? c.total - c.n : 0;
}

// Stock de la compra DESPUÉS del ciclo (Σ cuotas n=actual+1..total).
export function deudaRestanteDe(compra, cicloKey, diaCierre, diaVencimiento) {
  const c = cuotaEnCiclo(compra, cicloKey, diaCierre, diaVencimiento);
  if (!c) return 0;

  let total = 0;
  for (let n = c.n + 1; n <= c.total; n += 1) {
    total += montoCuotaDe(compra, n);
  }
  return total;
}

// Ciclo donde cae la cuota n (proyección).
export function cicloDeCuota(compra, n, diaCierre, diaVencimiento) {
  const fecha = aDate(compra?.fecha);
  if (!fecha) return null;

  const total = cuotasTotalDe(compra);
  if (!Number.isInteger(n) || n < 1 || n > total) return null;

  const cicloCompra = cicloDeFecha(fecha, diaCierre, diaVencimiento);
  if (!cicloCompra) return null;

  return sumarCiclos(cicloCompra, n - 1);
}

// "1/6"
export function etiquetaCuota(n, total) {
  return `${n}/${total}`;
}
