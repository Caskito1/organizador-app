// agregar/components/reintegros/helpers/eliminarEntrega.js
// 4.3-bis — Eliminación lógica de una entrega (PO-7/DC-6): transacción que
// (1) lee entrega + obligación; (2) valida: entrega no eliminada (I-11),
// obligación existente, activa (sin condonación — entregas congeladas D-9 —
// ni eliminación) y NO liquidada (guardia de cliente — decisión 4.3-bis:
// la eliminación de pagos es solo de obligaciones abiertas, igual que la
// edición de 4.3b; la rama (i) de reglas server-side no la bloquea);
// (3) marca la entrega con su constancia `eliminacion` (quién, cuándo,
// motivo opcional — DC-6; el doc original queda íntegro); (4) recalcula
// `devuelto` SOBRE el estado leído (leído − monto de la entrega, ≥ 0;
// nunca una resta ciega — criterio 3.8'); (5) escribe el evento
// `eliminacion`/`entrega`. Rollback total ante cualquier fallo. Si la
// entrega eliminada había llevado el saldo a 0, la obligación se reabre
// (estado derivado vuelve a pendiente/parcial — DC-2). Recibe `db` como
// parámetro: el harness pasa la instancia del emulador; la app pasa `db`
// de @/lib/firebase.

import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { ReintegroError } from "./submitDevolucion.js";

export async function eliminarEntrega({ db, uid, did, motivo = null }) {
  if (motivo != null && typeof motivo !== "string") {
    throw new ReintegroError("VALIDACION", "motivo debe ser string o null");
  }

  await runTransaction(db, async (tx) => {
    const entRef = doc(db, "reintegro_devoluciones", did);
    const entSnap = await tx.get(entRef);
    if (!entSnap.exists()) {
      throw new ReintegroError("NO_ENCONTRADA", "Entrega no encontrada");
    }
    const ent = entSnap.data();
    // I-11: una entrega eliminada es inmutable y no se re-elimina.
    if ("eliminacion" in ent) {
      throw new ReintegroError(
        "ELIMINADA",
        "Esta entrega ya fue eliminada.",
      );
    }

    const rid = ent.reintegroId;
    const oblRef = doc(db, "reintegros", rid);
    const oblSnap = await tx.get(oblRef);
    if (!oblSnap.exists()) {
      throw new ReintegroError("NO_ENCONTRADA", "Obligación no encontrada");
    }
    const obl = oblSnap.data();
    if ("eliminacion" in obl) {
      throw new ReintegroError("ELIMINADA", "Obligación eliminada");
    }
    // D-9: sobre condonada las entregas están congeladas (reglas (i) la
    // bloquean igualmente).
    if ("condonacion" in obl) {
      throw new ReintegroError(
        "CONDONADA",
        "Obligación perdonada: sus pagos están congelados.",
      );
    }
    // Guardia de cliente LIQUIDADA (decisión 4.3-bis): los pagos se
    // eliminan solo desde obligaciones abiertas. Barrera de cliente — la
    // rama (i) de reglas no la bloquea.
    const saldo = Number(obl.monto || 0) - Number(obl.devuelto || 0);
    if (saldo <= 0) {
      throw new ReintegroError(
        "LIQUIDADA",
        "Obligación liquidada: la eliminación de pagos es solo de obligaciones abiertas.",
      );
    }

    // Recálculo sobre el estado leído (criterio 3.8'): si el monto de la
    // entrega excede el `devuelto` leído hay corrupción de datos — bug
    // report, nunca corrección silenciosa (D-6).
    const montoEntrega = Number(ent.monto || 0);
    const nuevoDevuelto = Number(obl.devuelto || 0) - montoEntrega;
    if (nuevoDevuelto < 0) {
      throw new ReintegroError(
        "VALIDACION",
        `Inconsistencia: entrega ${did} (monto ${montoEntrega}) excede devuelto ${obl.devuelto} de ${rid}`,
      );
    }

    tx.update(entRef, {
      eliminacion: {
        eliminadaPor: uid,
        createdAt: serverTimestamp(),
        motivo: motivo || null,
      },
    });
    tx.update(oblRef, { devuelto: nuevoDevuelto });
    tx.set(doc(collection(db, "reintegros", rid, "eventos")), {
      registradoPor: uid,
      tipo: "eliminacion",
      entidad: "entrega",
      reintegroId: rid,
      entregaId: did,
      montoEliminado: montoEntrega,
      motivo: motivo || null,
      createdAt: serverTimestamp(),
    });
  });
}
