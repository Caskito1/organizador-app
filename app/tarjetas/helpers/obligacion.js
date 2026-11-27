// tarjetas/helpers/obligacion.js
// 6.3 — Obligación de reintegro que nace de una compra con tarjeta (PURO).
//
// Plan: PROPUESTA-ETAPA-6.md §13.3.2. La compra NO es gasto (modelo de caja):
// la obligación nace con movimientoInicial "ninguno" y tipo "tarjeta", por el
// TOTAL de la compra (una sola, sin dividir por cuota). Contraparte externa en
// v1 y vínculo bidireccional (la obligación guarda el id de la compra; la compra
// guarda el rid de la obligación, que agrega el servicio).
//
// El helper NO toca Firestore ni conoce Timestamps: valida y arma el payload de
// dominio; el servicio agrega registradoPor/devuelto/createdAt y convierte fecha.

import { aDate } from "../../gastos/helpers/dateHelpers.js";
import { TarjetasError } from "./persistencia.js";

export const CONCEPTO_POR_DEFECTO = "Compra con tarjeta";
export const MOTIVO_ELIMINACION = "Se eliminó la compra con tarjeta";

function requerirTexto(valor, campo) {
  if (typeof valor !== "string" || !valor.trim()) {
    throw new TarjetasError(
      "REINTEGRO_INVALIDO",
      `El reintegro de la compra requiere ${campo}.`,
    );
  }
  return valor.trim();
}

// Payload de dominio (sin createdAt ni serverTimestamp).
export function obligacionDeCompra({
  uid,
  uidNombre,
  compra,
  contraparteNombre,
} = {}) {
  if (!compra || typeof compra !== "object") {
    throw new TarjetasError("REINTEGRO_INVALIDO", "Compra inválida.");
  }
  if (!uid || typeof uid !== "string") {
    throw new TarjetasError("REINTEGRO_INVALIDO", "Falta el usuario.");
  }
  if (compra.tipo !== "reintegro") {
    throw new TarjetasError(
      "REINTEGRO_INVALIDO",
      "Solo una compra de tipo reintegro genera obligación.",
    );
  }
  if (compra.moneda !== "UYU") {
    throw new TarjetasError(
      "REINTEGRO_EN_USD",
      "El reintegro de una compra en dólares no está disponible en v1.",
    );
  }
  if (!Number.isInteger(compra.monto) || compra.monto <= 0) {
    throw new TarjetasError(
      "REINTEGRO_INVALIDO",
      "El monto de la compra debe ser un entero mayor a 0.",
    );
  }
  const cuotasTotal =
    compra.cuotasTotal === undefined ? 1 : Number(compra.cuotasTotal);
  if (!Number.isInteger(cuotasTotal) || cuotasTotal < 1) {
    throw new TarjetasError(
      "REINTEGRO_INVALIDO",
      "Las cuotas deben ser un entero mayor o igual a 1.",
    );
  }
  if (typeof compra.id !== "string" || !compra.id) {
    throw new TarjetasError(
      "REINTEGRO_INVALIDO",
      "La compra necesita un id para vincular la obligación.",
    );
  }
  const fecha = aDate(compra.fecha);
  if (!fecha) {
    throw new TarjetasError("REINTEGRO_INVALIDO", "Fecha de la compra inválida.");
  }

  const nombre = requerirTexto(uidNombre, "el nombre del registrador");
  const contraparte = requerirTexto(
    contraparteNombre,
    "el nombre de quien te debe",
  );
  const detalle =
    typeof compra.detalle === "string" ? compra.detalle.trim() : "";

  return {
    sentido: "por_cobrar",
    monto: compra.monto, // TOTAL, no la cuota
    movimientoInicial: "ninguno",
    movimientoInicialTipo: "tarjeta",
    gastoVinculadoId: compra.id, // compraId
    contraparteUid: null, // externa (v1)
    contraparteNombre: contraparte,
    participantes: [uid],
    groupId: null,
    concepto: detalle || CONCEPTO_POR_DEFECTO,
    detalle: null,
    fecha,
    registradoPorNombre: nombre,
  };
}
