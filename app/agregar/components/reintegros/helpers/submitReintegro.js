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
  Timestamp,
} from "firebase/firestore";
// 5.0-fecha: 'YYYY-MM-DD' → Date a medianoche LOCAL (helper puro compartido
// con gastos/ingresos). Import RELATIVO con extensión: este archivo también
// lo carga el harness con node --test (sin alias `@/`).
import { fechaLocal } from "../../../../gastos/helpers/dateHelpers.js";
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
  movimientoInicialTipo,
  fechaISO,
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
  // 4.3c: movimientoInicialTipo es OPCIONAL (las obligaciones viejas no lo
  // traen). Si viene, debe ser un valor válido y SOLO en por_cobrar — en
  // por_devolver el dinero/ítem ya vive en movimientoInicial.
  if (movimientoInicialTipo !== undefined) {
    if (!["dinero", "item"].includes(movimientoInicialTipo)) {
      throw new ReintegroError(
        "VALIDACION",
        `movimientoInicialTipo inválido: ${movimientoInicialTipo}`,
      );
    }
    if (sentido !== "por_cobrar") {
      throw new ReintegroError(
        "VALIDACION",
        `movimientoInicialTipo solo aplica a por_cobrar (recibido en: ${sentido})`,
      );
    }
  }
  if (!contraparteNombre?.trim()) {
    throw new ReintegroError(
      "VALIDACION",
      "contraparteNombre requerido (externo o miembro)",
    );
  }

  // 5.0-fecha: `fechaISO` es OPCIONAL en el helper (compatibilidad con los
  // llamados existentes del harness y con clientes viejos); la app la envía
  // SIEMPRE (canSubmit). Si viene, se persiste `fecha` como Timestamp a
  // medianoche LOCAL: un parseo UTC correría el día —y el mes— en el borde
  // (misma convención que DevolucionModal y 4.5-fecha). Sin `fechaISO` el
  // documento queda con la forma heredada y cuenta por `createdAt` (F-3).
  let fecha = null;
  if (fechaISO !== undefined && fechaISO !== null) {
    if (typeof fechaISO !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) {
      throw new ReintegroError(
        "FECHA_INVALIDA",
        `fecha inválida: ${String(fechaISO)}`,
      );
    }
    const [y, m, d] = fechaISO.split("-").map(Number);
    const local = fechaLocal(fechaISO);
    // El rollover de Date (2026-02-31 → 03/03) no debe pasar en silencio.
    if (
      Number.isNaN(local.getTime()) ||
      local.getFullYear() !== y ||
      local.getMonth() !== m - 1 ||
      local.getDate() !== d
    ) {
      throw new ReintegroError("FECHA_INVALIDA", `fecha inválida: ${fechaISO}`);
    }
    fecha = Timestamp.fromDate(local);
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
    // 4.3c: se persiste SOLO cuando llega (por_cobrar); por_devolver y las
    // llamadas sin el parámetro quedan sin el campo (esquema limpio).
    if (movimientoInicialTipo !== undefined) {
      payload.movimientoInicialTipo = movimientoInicialTipo;
    }
    // 5.0-fecha: idem — solo cuando llega, para no ensuciar los documentos
    // creados por llamados sin fecha (forma heredada, F-3).
    if (fecha) {
      payload.fecha = fecha;
    }

    tx.set(doc(db, "reintegros", rid), payload);

    // Bitácora D-3: evento creacion/obligacion en la misma transacción.
    // 4.4-bis: esquema canónico — `monto` + `sentido` (aditivo; los eventos
    // anteriores al 30/10/2026 no los tienen y se toleran). `devuelto` se
    // omite a propósito: el alta siempre nace con devuelto == 0 (reglas).
    tx.set(doc(collection(db, "reintegros", rid, "eventos")), {
      registradoPor: uid,
      tipo: "creacion",
      entidad: "obligacion",
      monto,
      sentido,
      createdAt: serverTimestamp(),
    });
  });

  return { rid };
}
