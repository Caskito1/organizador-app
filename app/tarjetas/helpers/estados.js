// tarjetas/helpers/estados.js
// 6.0 — Modelo PURO de la tarjeta: estados del ciclo (§14.9).
//
// Tres estados, persistidos en users/{uid}.tarjetas[tarjetaId].ciclos:
//   sin_verificar → ciclo abierto, cargando compras   → botón «Cargar compra»
//   por_pagar     → factura consolidada, lista        → botón «Pagar resumen»
//   pagada        → pagada; las cuotas pasan al ciclo siguiente → sin botón
//
// `sin_verificar` es el default IMPLÍCITO (no se persiste hasta consolidar).

export const ESTADOS_CICLO = ["sin_verificar", "por_pagar", "pagada"];

export function estadoCiclo(ciclos, cicloKey) {
  const estado = ciclos?.[cicloKey]?.estado;
  return ESTADOS_CICLO.includes(estado) ? estado : "sin_verificar";
}

export function botonDelCiclo(estado) {
  if (estado === "sin_verificar") return "cargar";
  if (estado === "por_pagar") return "pagar";
  return null;
}

export function esCicloPagable(ciclos, cicloKey) {
  return estadoCiclo(ciclos, cicloKey) === "por_pagar";
}

export function esCicloPagado(ciclos, cicloKey) {
  return estadoCiclo(ciclos, cicloKey) === "pagada";
}
