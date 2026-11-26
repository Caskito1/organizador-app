// tarjetas/helpers/resumen.js
// 6.2 — Resumen de presentación del ciclo (PURO, sin SDK).
// Plan: PROPUESTA-ETAPA-6.md §12.7/§12.11.
//
// Resuelve dos pendientes de 6.0/6.1 SIN tocar el núcleo:
//   · La apertura se pliega en «Personales» UNA sola vez (no se duplica).
//   · `cuotasDelCiclo` y `cuotasPorVencer` se unifican: AMBOS incluyen apertura.
// Invariante: `personales + reintegros = total` por moneda.

import { cuotaAperturaEnCiclo } from "./apertura.js";
import { desgloseCiclo } from "./deuda.js";

function listaDe(coleccion) {
  if (!coleccion) return [];
  return Array.isArray(coleccion) ? coleccion : Object.values(coleccion);
}

export function resumenCiclo({
  compras,
  apertura,
  cicloKey,
  diaCierre,
  diaVencimiento,
} = {}) {
  const desglose = desgloseCiclo({
    compras,
    apertura,
    cicloKey,
    diaCierre,
    diaVencimiento,
  });

  // Cada plan tiene como máximo una cuota por ciclo: contar planes = contar cuotas.
  const cuotasApertura = listaDe(apertura).filter((plan) =>
    cuotaAperturaEnCiclo(plan, cicloKey),
  ).length;

  return {
    personales: {
      UYU: desglose.personales.UYU + desglose.apertura.UYU,
      USD: desglose.personales.USD + desglose.apertura.USD,
    },
    reintegros: {
      UYU: desglose.reintegros.UYU,
      USD: desglose.reintegros.USD,
    },
    total: desglose.total,
    deudaPorVencer: desglose.deudaPorVencer,
    cuotasDelCiclo: desglose.cuotasDelCiclo + cuotasApertura,
    cuotasPorVencer: desglose.cuotasPorVencer,
  };
}
