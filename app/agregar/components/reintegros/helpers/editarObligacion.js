// agregar/components/reintegros/helpers/editarObligacion.js
// 4.3b — Edición de monto de una obligación (D-8(ii), rama (c)): transacción
// que cambia SOLO el campo `monto` (hasOnly(['monto'])) y registra el evento
// `edicion` / `obligacion` con montoAnterior y montoNuevo (D-3). SOLO el
// registrador puede editarla (rama (c) exige esRegistrador; el helper lo
// valida en cliente para un error limpio y las reglas re-verifican). Con
// `devuelto > 0` el monto queda bloqueado (D-8(ii): editable solo con cero
// pagos). Guardas de cliente: liquidada/condonada/eliminada no se editan
// (condonada y eliminada también las bloquean las reglas). Recibe `db` como
// parámetro: el harness pasa la instancia del emulador; la app pasa `db` de
// @/lib/firebase.

import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { ReintegroError } from "./submitDevolucion.js";

export async function editarObligacion({ db, uid, rid, monto }) {
  // Montos: SIEMPRE enteros en pesos (decisión del usuario, 16/10/2026).
  if (!Number.isInteger(monto)) {
    throw new ReintegroError(
      "MONTO_INVALIDO",
      `Monto debe ser entero en pesos, recibido: ${monto}`,
    );
  }
  if (!(monto > 0)) {
    throw new ReintegroError("MONTO_INVALIDO", "Monto debe ser > 0");
  }

  await runTransaction(db, async (tx) => {
    const oblRef = doc(db, "reintegros", rid);
    const oblSnap = await tx.get(oblRef);
    if (!oblSnap.exists()) {
      throw new ReintegroError("NO_ENCONTRADA", "Obligación no encontrada");
    }
    const obl = oblSnap.data();
    if ("eliminacion" in obl) {
      throw new ReintegroError("ELIMINADA", "Obligación eliminada");
    }
    if ("condonacion" in obl) {
      throw new ReintegroError("CONDONADA", "Obligación condonada");
    }
    // D-8(ii) / rama (c): solo el registrador edita el monto. Guardia de
    // cliente para error limpio; las reglas re-verifican esRegistrador.
    if (obl.registradoPor !== uid) {
      throw new ReintegroError(
        "NO_REGISTRADOR",
        "Solo quien registró la obligación puede editar su monto.",
      );
    }

    const devuelto = Number(obl.devuelto || 0);
    // D-8(ii): monto editable SOLO con devuelto == 0 (sin pagos). Cubre
    // también el caso liquidado (devuelto == monto > 0).
    if (devuelto > 0) {
      throw new ReintegroError(
        "MONTO_BLOQUEADO",
        "Ya hay pagos registrados: el monto solo se edita con $0 devuelto.",
      );
    }
    // Edición sin cambios: no escribe ni genera evento (espejo del
    // `monto != resource.data.monto` de la rama (c)).
    const montoViejo = Number(obl.monto);
    if (monto === montoViejo) {
      throw new ReintegroError(
        "MONTO_SIN_CAMBIOS",
        "El monto es igual al actual: no hay nada que guardar.",
      );
    }

    // Rama (c): SOLO cambia `monto`; devuelto permanece en 0.
    tx.update(oblRef, { monto });

    // Bitácora D-3: evento edicion/obligacion en la misma transacción.
    tx.set(doc(collection(db, "reintegros", rid, "eventos")), {
      registradoPor: uid,
      tipo: "edicion",
      entidad: "obligacion",
      montoAnterior: montoViejo,
      montoNuevo: monto,
      createdAt: serverTimestamp(),
    });
  });
}
