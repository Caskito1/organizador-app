// tarjetas/helpers/apertura.js
// 6.0 — Modelo PURO de la tarjeta: deuda de apertura por plan (§14.8).
//
// Plan: PROPUESTA-ETAPA-6.md §10.6. Los planes en curso al corte (Peñarol,
// opencodeGo) son DATOS que fija el usuario (`desdeCiclo`, `cuotasTotal`,
// `montoCuota`); el helper no conoce sus valores. La cuota actual se DERIVA de
// `desdeCiclo` + el ciclo consultado; nada de cuota actual persistida.
//
// `montoCuota` es un dato fijo por plan: no hay redondeo acá.

import { ciclosEntre } from "./ciclo.js";

function listaDe(coleccion) {
  if (!coleccion) return [];
  return Array.isArray(coleccion) ? coleccion : Object.values(coleccion);
}

function cuotasTotalDe(plan) {
  return Math.max(1, Math.trunc(Number(plan?.cuotasTotal ?? 1)));
}

// Cuota del plan en un ciclo, o null si no cae en él.
export function cuotaAperturaEnCiclo(plan, cicloKey) {
  if (!plan || typeof plan.desdeCiclo !== "string") return null;

  const total = cuotasTotalDe(plan);
  const diff = ciclosEntre(plan.desdeCiclo, cicloKey);
  if (diff === null) return null;

  const n = diff + 1;
  if (n < 1 || n > total) return null;

  return {
    cuotaActual: n,
    cuotasRestantes: total - n,
    monto: Number(plan.montoCuota ?? 0),
  };
}

// Cuotas del plan DESPUÉS del ciclo (0 si no empezó o ya terminó).
export function cuotasRestantesApertura(plan, cicloKey) {
  if (!plan || typeof plan.desdeCiclo !== "string") return 0;

  const total = cuotasTotalDe(plan);
  const diff = ciclosEntre(plan.desdeCiclo, cicloKey);
  if (diff === null || diff < 0) return 0;

  const due = Math.min(diff + 1, total);
  return Math.max(0, total - due);
}

// Stock del plan DESPUÉS del ciclo (cuotas restantes × montoCuota).
export function deudaRestanteApertura(plan, cicloKey) {
  return cuotasRestantesApertura(plan, cicloKey) * Number(plan?.montoCuota ?? 0);
}

// Σ por moneda de las cuotas de apertura que caen en el ciclo.
export function aPagarAperturaEnCiclo(planes, cicloKey) {
  const total = { UYU: 0, USD: 0 };

  for (const plan of listaDe(planes)) {
    const cuota = cuotaAperturaEnCiclo(plan, cicloKey);
    if (!cuota) continue;
    const moneda = plan?.moneda === "USD" ? "USD" : "UYU";
    total[moneda] += cuota.monto;
  }

  return total;
}
