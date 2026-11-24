// gastos/helpers/fijosCriterio.js
// Criterio de los gastos fijos compartido por /gastos y el balance (5.1, A-1).
// PURO (sin SDK) para poder testearlo con node --test sin emulador.
//
// Este archivo es la ÚNICA fuente de /gastos ↔ balance: `esPagado` es la regla
// de 2.2 (copia literal de useGastos.js:97-99) y la parte 50 %/100 % es la de
// useGastos.js:84 y :110. No se crea una segunda fórmula.
//
// useFixedExpenses.js mantiene su duplicado documentado para el header de
// /gastos-fijos (2.8/2.9): no se toca en 5.1.

// ¿La entry del fijo cuenta como pagada en su período?
// `paidByUid` manda; el anual vigente (`pagoHasta > periodo`) cuenta aunque
// `paidByUid` sea null. `estado` NUNCA se usa (2.2).
export function esPagado(entry) {
  return (
    !!entry?.paidByUid ||
    (!!entry?.pagoHasta && entry.pagoHasta > entry?.periodo)
  );
}

// Parte del usuario del monto de un fijo: 100 % si es personal y 50 % si es
// compartido (porcentaje hardcodeado hoy; dominio §8).
export function parteDelUsuarioDeFijo(entry) {
  const monto = Number(entry?.montoTotal || 0);

  return entry?.groupId ? monto / 2 : monto;
}
