// agregar/components/reintegros/helpers/submitReintegro.js
// Alta de obligación atómica: doc de reintegro + evento creacion/obligacion
// en la MISMA runTransaction (getAfter en eventos lo permite, spike 4.1).
//
// Decisión (EVIDENCIA §7): runTransaction, NO writeBatch. Aunque el alta no
// necesita leer, writeBatch aplica LATENCY COMPENSATION local: el onSnapshot
// de la suscripción del propio creador ve el obl local ANTES de que el backend
// lo confirme. La query D1 (devoluciones) se dispara en esa ventana y su regla
// `list` hace get() del padre en el backend, que aún no lo ve → error
// transitorio (hallazgo HS0+HS1, 16/10/2026). runTransaction commitea
// atómicamente en el servidor SIN compensación local: la suscripción nunca
// observa estado a medio commitear. Coste: offline runTransaction falla por
// diseño (no hay cola de transacciones) — el alta requiere red, documentado.
// Recibe `db` como parámetro (sin config de Firebase): el harness pasa la
// instancia del emulador; la app pasa `db` de @/lib/firebase.

import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { ReintegroError } from "./submitDevolucion.js";

export async function submitReintegro({
  db,
  uid,
  uidNombre,
  sentido,
  monto,
  contraparteUid,
  contraparteNombre,
  groupId,
  concepto,
  detalle,
  movimientoInicial,
  rid: ridParam,
}) {
  // Montos: SIEMPRE enteros en pesos (decisión del usuario, 16/10/2026).
  // Sin centavos; si se admiten centavos, migrar a unidad menor (centavos).
  if (!Number.isInteger(monto)) {
    throw new ReintegroError(
      "MONTO_INVALIDO",
      `Monto debe ser entero en pesos, recibido: ${monto}`,
    );
  }
  if (!(monto > 0)) {
    throw new ReintegroError("MONTO_INVALIDO", "Monto debe ser > 0");
  }
  if (!uidNombre?.trim()) {
    throw new ReintegroError("VALIDACION", "uidNombre es requerido");
  }
  if (!concepto?.trim()) {
    throw new ReintegroError("VALIDACION", "concepto requerido");
  }
  if (!["por_cobrar", "por_devolver"].includes(sentido)) {
    throw new ReintegroError(
      "VALIDACION",
      `sentido inválido: ${sentido}`,
    );
  }
  if (!["ninguno", "salida", "entrada"].includes(movimientoInicial)) {
    throw new ReintegroError(
      "VALIDACION",
      `movimientoInicial inválido: ${movimientoInicial}`,
    );
  }
  if (!contraparteNombre?.trim()) {
    throw new ReintegroError(
      "VALIDACION",
      "contraparteNombre requerido (externo o miembro)",
    );
  }

  // Ajuste 6 (4.2): la UI puede enviar "" o undefined (estado vacío del
  // selector) para contraparte externa; se normaliza a null ANTES de armar
  // participantes y el payload. "" JAMÁS se persiste. Tipos no-string
  // (p. ej. números) son error de validación.
  const cpUid =
    contraparteUid === undefined ||
    contraparteUid === null ||
    contraparteUid === ""
      ? null
      : contraparteUid;
  if (cpUid !== null && typeof cpUid !== "string") {
    throw new ReintegroError(
      "VALIDACION",
      `contraparteUid inválido: ${String(contraparteUid)}`,
    );
  }

  const participantes = cpUid ? [uid, cpUid] : [uid];
  // rid opcional (4.2): el ReintegroModal lo genera UNA sola vez al abrir y
  // lo reutiliza en cada reintento — si un intento por timeout de UI terminó
  // commiteando, el siguiente escribe sobre el MISMO doc (nunca duplica).
  // Sin parámetro (harness 4.1 y llamadas existentes): se genera acá.
  if (ridParam !== undefined && !ridParam) {
    throw new ReintegroError("VALIDACION", "rid debe ser string no vacío");
  }
  const rid = ridParam || doc(collection(db, "reintegros")).id;

  await runTransaction(db, async (tx) => {
    // Shape exacto exigido por las reglas (create de reintegros):
    // devuelto:0, gastoVinculadoId:null, createdAt==request.time,
    // sin condonacion/eliminacion y SIN confirmadaPor (17/10/2026:
    // sin confirmación bilateral — el campo está prohibido en el alta).
    const payload = {
      registradoPor: uid,
      registradoPorNombre: uidNombre.trim(),
      contraparteUid: cpUid,
      contraparteNombre: contraparteNombre.trim(),
      participantes,
      groupId: groupId ?? null,
      sentido,
      monto,
      devuelto: 0,
      movimientoInicial,
      concepto: concepto.trim(),
      detalle: detalle?.trim() || null,
      gastoVinculadoId: null,
      createdAt: serverTimestamp(),
    };

    tx.set(doc(db, "reintegros", rid), payload);

    // Bitácora D-3: evento creacion/obligacion en la misma transacción.
    tx.set(doc(collection(db, "reintegros", rid, "eventos")), {
      registradoPor: uid,
      tipo: "creacion",
      entidad: "obligacion",
      createdAt: serverTimestamp(),
    });
  });

  return { rid };
}
