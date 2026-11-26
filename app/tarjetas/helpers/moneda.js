// tarjetas/helpers/moneda.js
// 6.0 — Modelo PURO de la tarjeta: bimoneda (UYU | USD).
//
// Plan: PROPUESTA-ETAPA-6.md §10.7 / §14.3. Regla dura: UYU y USD NUNCA se
// suman; cada total es un par { UYU, USD }. Reusa UYU/USD/sumarPorMoneda de
// ingresosMoneda.js (misma fuente que el resto de la app).

import {
  UYU,
  USD,
  sumarPorMoneda,
} from "../../ingresos/helpers/ingresosMoneda.js";

export { UYU, USD, sumarPorMoneda };

export const MONEDAS = [UYU, USD];

export function esMoneda(moneda) {
  return moneda === UYU || moneda === USD;
}

// Moneda efectiva de un documento de tarjeta; sin campo (o inválida) → UYU.
// (Las compras/pagos nuevos siempre traen `moneda`; el fallback es defensivo.)
export function monedaDe(x) {
  return x?.moneda === USD ? USD : UYU;
}

// Σ de una lista de objetos { UYU, USD } (p. ej. los totales del desglose).
// Devuelve SIEMPRE un par { UYU, USD }; no colapsa a un único número.
export function sumarObjetosPorMoneda(objetos) {
  const total = { [UYU]: 0, [USD]: 0 };

  for (const objeto of objetos ?? []) {
    if (!objeto) continue;
    total[UYU] += Number(objeto[UYU] ?? 0);
    total[USD] += Number(objeto[USD] ?? 0);
  }

  return total;
}
