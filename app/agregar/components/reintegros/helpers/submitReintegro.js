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

  const participantes = contraparteUid ? [uid, contraparteUid] : [uid];
  const rid = doc(collection(db, "reintegros")).id;

  await runTransaction(db, async (tx) => {
    // Shape exacto exigido por las reglas (create de reintegros):
    // devuelto:0, gastoVinculadoId:null, createdAt==request.time,
    // sin condonacion/eliminacion, confirmadaPor:null SOLO para miembro.
    const payload = {
      registradoPor: uid,
      registradoPorNombre: uidNombre.trim(),
      contraparteUid: contraparteUid ?? null,
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
    // 4.6: confirmadaPor presente (en null) solo si hay contraparte miembro;
    // para externos el campo debe estar AUSENTE (regla de create).
    if (contraparteUid) {
      payload.confirmadaPor = null;
    }

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
