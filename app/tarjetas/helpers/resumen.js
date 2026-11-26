// tarjetas/helpers/resumen.js
// 6.2 — Resumen y lista de presentación del ciclo (PURO, sin SDK).
// Plan: PROPUESTA-ETAPA-6.md §12.7/§12.11.
//
// · `comprasDelCiclo` es la ÚNICA fuente de la lista: incluye TODA compra con
//   una cuota en el ciclo (también las de ciclos anteriores: 2/n, 3/n…), con el
//   MISMO criterio que el cálculo (`cuotaEnCiclo`).
// · `resumenCiclo` pliega la apertura en «Personales» UNA sola vez, unifica los
//   conteos (apertura en ambos) y agrega `deudaTotal = a pagar + por vencer`.
// Invariante: `personales + reintegros = total` por moneda.

import { aDate } from "../../gastos/helpers/dateHelpers.js";
import { cuotaAperturaEnCiclo } from "./apertura.js";
import { cuotaEnCiclo } from "./cuota.js";
import { desgloseCiclo } from "./deuda.js";

function listaDe(coleccion) {
  if (!coleccion) return [];
  return Array.isArray(coleccion) ? coleccion : Object.values(coleccion);
}

// Compras con una cuota en el ciclo, ordenadas por fecha asc.
// Incluye las compras de ciclos anteriores (cuota 2/n, 3/n…): el mismo criterio
// que usa `desgloseCiclo` para los totales.
export function comprasDelCiclo({
  compras,
  cicloKey,
  diaCierre,
  diaVencimiento,
} = {}) {
  return listaDe(compras)
    .map((compra) => ({
      compra,
      cuota: cuotaEnCiclo(compra, cicloKey, diaCierre, diaVencimiento),
    }))
    .filter((item) => item.cuota)
    .sort(
      (a, b) =>
        (aDate(a.compra.fecha)?.getTime() ?? 0) -
        (aDate(b.compra.fecha)?.getTime() ?? 0),
    );
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

  const cuotasDelCiclo = desglose.cuotasDelCiclo + cuotasApertura;
  const cuotasPorVencer = desglose.cuotasPorVencer;

  // Deuda total = a pagar del ciclo + cuotas futuras (incluye la factura actual).
  const deudaTotal = {
    UYU: desglose.total.UYU + desglose.deudaPorVencer.UYU,
    USD: desglose.total.USD + desglose.deudaPorVencer.USD,
  };

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
    deudaTotal,
    cuotasDelCiclo,
    cuotasPorVencer,
    cuotasTotales: cuotasDelCiclo + cuotasPorVencer,
  };
}
