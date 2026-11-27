// tarjetas/helpers/pendiente.js
// 6.2-bis — Factura pendiente (PURO, sin SDK, sin alias @/).
//
// Regla (27/11/2026):
//   «Pendiente» = ciclo ESTRICTAMENTE ANTERIOR al actual que (a) tenga datos
//   —alguna compra con cuota en el ciclo o alguna cuota de apertura— y (b) su
//   estado no sea `pagada`. Un ciclo pasado SIN datos nunca es pendiente; el
//   ciclo actual nunca es pendiente.
//   Si hay varios, se resuelven del más viejo al más nuevo.
//
// Este módulo NO cambia el modelo: solo deriva qué ciclo quedó sin resolver y
// qué escrituras caen en ciclos posteriores (bloqueadas hasta pagarlo).

import { cicloDeFecha, sumarCiclos } from "./ciclo.js";
import { cicloDeCuota } from "./cuota.js";
import { estadoCiclo } from "./estados.js";

function listaDe(coleccion) {
  if (!coleccion) return [];
  return Array.isArray(coleccion) ? coleccion : Object.values(coleccion);
}

function cuotasTotalDe(item) {
  return Math.max(1, Math.trunc(Number(item?.cuotasTotal ?? 1)));
}

// Ciclos en los que cae alguna cuota de la compra (1..cuotasTotal).
export function ciclosDeCompra(compra, diaCierre, diaVencimiento) {
  const total = cuotasTotalDe(compra);
  const claves = [];

  for (let n = 1; n <= total; n += 1) {
    const clave = cicloDeCuota(compra, n, diaCierre, diaVencimiento);
    if (clave) claves.push(clave);
  }

  return claves;
}

// Ciclos en los que cae alguna cuota del plan de apertura.
export function ciclosDeApertura(plan) {
  if (!plan || typeof plan.desdeCiclo !== "string") return [];

  const total = cuotasTotalDe(plan);
  const claves = [];

  for (let i = 0; i < total; i += 1) {
    const clave = sumarCiclos(plan.desdeCiclo, i);
    if (clave) claves.push(clave);
  }

  return claves;
}

// Conjunto de ciclos con datos (compras o apertura). Los ciclos sin datos no
// entran: no pueden ser pendientes ni bloquear.
export function ciclosConDatos({
  compras,
  apertura,
  diaCierre,
  diaVencimiento,
} = {}) {
  const claves = new Set();

  for (const compra of listaDe(compras)) {
    for (const clave of ciclosDeCompra(compra, diaCierre, diaVencimiento)) {
      claves.add(clave);
    }
  }
  for (const plan of listaDe(apertura)) {
    for (const clave of ciclosDeApertura(plan)) {
      claves.add(clave);
    }
  }

  return claves;
}

// El pendiente más viejo, o null si no hay ninguno.
export function cicloPendiente({
  compras,
  apertura,
  ciclos,
  cicloActual,
  diaCierre,
  diaVencimiento,
} = {}) {
  if (!cicloActual) return null;

  const candidatos = [...ciclosConDatos({ compras, apertura, diaCierre, diaVencimiento })]
    .filter(
      (clave) =>
        clave < cicloActual && estadoCiclo(ciclos, clave) !== "pagada",
    )
    .sort();

  return candidatos[0] ?? null;
}

export function hayPendiente(params = {}) {
  return cicloPendiente(params) !== null;
}

// ¿La escritura sobre `cicloKey` cae en un ciclo posterior al pendiente?
export function cicloBloqueado({ cicloKey, ...params } = {}) {
  if (!cicloKey) return false;

  const pendiente = cicloPendiente(params);
  return !!pendiente && cicloKey > pendiente;
}

// ¿La compra toca algún ciclo posterior al pendiente? (editar/eliminar una
// compra con cuotas futuras también afecta esos ciclos.)
export function compraBloqueada({ compra, ...params } = {}) {
  const pendiente = cicloPendiente(params);
  if (!pendiente) return false;

  return ciclosDeCompra(compra, params.diaCierre, params.diaVencimiento).some(
    (clave) => clave > pendiente,
  );
}

// Utilidad para el ciclo actual de una tarjeta.
export function cicloActualDe(tarjeta, ahora = new Date()) {
  if (!tarjeta) return null;
  return cicloDeFecha(ahora, tarjeta.diaCierre, tarjeta.diaVencimiento);
}
