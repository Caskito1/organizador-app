// tarjetas/helpers/edicion.js
// 6.2 — ¿Qué se puede editar? (PURO, sin SDK).
// Plan: PROPUESTA-ETAPA-6.md §12.6 y A-5.
//
// · Compras: solo las «nuevas» — cuota 1/n en un ciclo SIN verificar.
// · Apertura (A-5): solo mientras NINGUNA de sus cuotas haya caído en un ciclo
//   pagado/consolidado (mismo criterio de fondo que las compras).
//
// 6.1 permite editar cualquier compra/plan; este módulo es la barrera de UI.

import { sumarCiclos } from "./ciclo.js";
import { cuotaEnCiclo } from "./cuota.js";
import { estadoCiclo } from "./estados.js";

export function esCompraEditable(
  compra,
  { cicloKey, cicloActual, estado, diaCierre, diaVencimiento } = {},
) {
  // Solo el ciclo ACTUAL (el que contiene hoy) y mientras esté sin verificar.
  if (!cicloActual || cicloKey !== cicloActual) return false;
  if (estado !== "sin_verificar") return false;

  const cuota = cuotaEnCiclo(compra, cicloKey, diaCierre, diaVencimiento);
  return !!cuota && cuota.n === 1;
}

export function esAperturaEditable(plan, { ciclos } = {}) {
  if (!plan || typeof plan.desdeCiclo !== "string") return false;

  const total = Math.max(1, Math.trunc(Number(plan.cuotasTotal ?? 1)));

  for (let i = 0; i < total; i += 1) {
    const ciclo = sumarCiclos(plan.desdeCiclo, i);
    if (!ciclo) return false;

    // Si una cuota del plan cayó en un ciclo consolidado/pagado, se bloquea.
    if (estadoCiclo(ciclos, ciclo) !== "sin_verificar") return false;
  }

  return true;
}

// Expuesto por si 6.3/6.4 lo necesitan: cuántas cuotas del plan ya cayeron en
// ciclos consolidados/pagados.
export function cuotasAperturaEnCiclosCerrados(plan, { ciclos } = {}) {
  if (!plan || typeof plan.desdeCiclo !== "string") return 0;

  const total = Math.max(1, Math.trunc(Number(plan.cuotasTotal ?? 1)));
  let cerradas = 0;

  for (let i = 0; i < total; i += 1) {
    const ciclo = sumarCiclos(plan.desdeCiclo, i);
    if (!ciclo) continue;
    if (estadoCiclo(ciclos, ciclo) !== "sin_verificar") cerradas += 1;
  }

  return cerradas;
}
