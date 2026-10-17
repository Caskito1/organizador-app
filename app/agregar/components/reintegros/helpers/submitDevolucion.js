// agregar/components/reintegros/helpers/submitDevolucion.js
// Devolución atómica: doc de entrega + update de `devuelto` + evento
// creacion/entrega en la MISMA transacción (acople D-6, criterio 3.8).
// `devuelto` SOLO se escribe aquí (incremento exacto del monto de la entrega).
// Recibe `db` como parámetro (sin config de Firebase): el harness pasa la
// instancia del emulador; la app pasa `db` de @/lib/firebase.

import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

// Errores tipados (ajuste 4.1): clase propia con código para que la UI
// pueda distinguirlos y mostrar mensajes específicos.
export class ReintegroError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ReintegroError";
    this.code = code;
  }
}

export async function submitDevolucion({
  db,
  uid,
  uidNombre,
  rid,
  monto,
  realizadoPorUid,
  realizadoPorNombre,
  fechaPago,
  detalle,
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
  if (!realizadoPorNombre?.trim()) {
    throw new ReintegroError(
      "VALIDACION",
      "realizadoPorNombre es requerido",
    );
  }
  if (!fechaPago) {
    throw new ReintegroError("VALIDACION", "fechaPago es requerido");
  }

  await runTransaction(db, async (tx) => {
    const oblRef = doc(db, "reintegros", rid);
    const oblSnap = await tx.get(oblRef);

    if (!oblSnap.exists()) {
      throw new ReintegroError("NO_ENCONTRADA", "Obligación no encontrada");
    }
    const obl = oblSnap.data();

    // Guardas de dominio (D-9): sin entregas sobre eliminada ni condonada.
    if ("eliminacion" in obl) {
      throw new ReintegroError("ELIMINADA", "Obligación eliminada");
    }
    if ("condonacion" in obl) {
      throw new ReintegroError("CONDONADA", "Obligación condonada");
    }
    // 4.6: sin entregas antes de confirmar (miembro sin confirmar).
    if (obl.contraparteUid != null && obl.confirmadaPor == null) {
      throw new ReintegroError(
        "SIN_CONFIRMAR",
        "Obligación de miembro sin confirmar por la contraparte",
      );
    }
    // Sobrepago rechazado también en cliente (las reglas lo rechazan igual).
    const saldo = Number(obl.monto) - Number(obl.devuelto);
    if (monto > saldo) {
      throw new ReintegroError(
        "SALDO_INSUFICIENTE",
        `Saldo insuficiente: saldo ${saldo}, intento ${monto}`,
      );
    }

    // Entrega (historial permanente; campo `detalle` según suite de reglas).
    tx.set(doc(collection(db, "reintegro_devoluciones")), {
      reintegroId: rid,
      monto,
      realizadoPorUid: realizadoPorUid ?? null,
      realizadoPorNombre: realizadoPorNombre.trim(),
      registradoPor: uid,
      registradoPorNombre: uidNombre,
      fechaPago,
      detalle: detalle?.trim() || null,
      createdAt: serverTimestamp(),
    });

    // Acople exacto (3.8): devuelto sube exactamente el monto de la entrega.
    tx.update(oblRef, { devuelto: Number(obl.devuelto) + monto });

    // Bitácora D-3: evento creacion/entrega en la misma transacción.
    tx.set(doc(collection(db, "reintegros", rid, "eventos")), {
      registradoPor: uid,
      tipo: "creacion",
      entidad: "entrega",
      createdAt: serverTimestamp(),
    });
  });
}
