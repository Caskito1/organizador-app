// agregar/components/reintegros/helpers/editarEntrega.js
// 4.3b — Edición de monto de una entrega (PO-7/DC-2): transacción que
// cambia SOLO el campo `monto` de la entrega (rama (ii) de reglas:
// hasOnly(['monto'])), recalcula el acumulador `devuelto` con el delta
// exacto (acople 3.8' vía getAfter) y registra el evento `edicion` /
// `entrega` con montoAnterior y montoNuevo (D-3, verificado 21/10/2026:
// el create de eventos no tiene hasOnly y el list es libre para
// participantes). AMBAS partes pueden editar (rama (ii) exige
// esParticipante, no registrador). Guardas de cliente: sobre obligación
// liquidada / condonada / eliminada no se escribe NADA — condonada y
// eliminada también las bloquean las reglas; LIQUIDADA es ÚNICAMENTE
// guardia de cliente (las reglas la permitirían porque bajar un pago
// reabriría la obligación; la decisión de producto 21/10/2026 es no
// editar en Saldados). Recibe `db` como parámetro: el harness pasa la
// instancia del emulador; la app pasa `db` de @/lib/firebase.

import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { ReintegroError } from "./submitDevolucion.js";

export async function editarEntrega({ db, uid, did, monto }) {
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
    const entRef = doc(db, "reintegro_devoluciones", did);
    const entSnap = await tx.get(entRef);
    if (!entSnap.exists()) {
      throw new ReintegroError("NO_ENCONTRADA", "Entrega no encontrada");
    }
    const ent = entSnap.data();
    // I-11: una entrega eliminada es inmutable (y las reglas la bloquean).
    if ("eliminacion" in ent) {
      throw new ReintegroError("ELIMINADA", "Esta entrega fue eliminada.");
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
    if ("condonacion" in obl) {
      throw new ReintegroError("CONDONADA", "Obligación condonada");
    }

    const montoViejo = Number(ent.monto);
    const devuelto = Number(obl.devuelto || 0);
    const montoObl = Number(obl.monto);

    // Guardia de CLIENTE (única barrera para liquidada — las reglas no la
    // bloquean): no se edita sobre una obligación ya saldada (Saldados).
    if (montoObl - devuelto <= 0) {
      throw new ReintegroError(
        "LIQUIDADA",
        "Esta obligación ya está saldada: no admite edición de pagos.",
      );
    }
    // Edición sin cambios: no escribe ni genera evento (espejo del
    // `monto != resource.data.monto` de la rama (ii)).
    if (monto === montoViejo) {
      throw new ReintegroError(
        "MONTO_SIN_CAMBIOS",
        "El monto es igual al actual: no hay nada que guardar.",
      );
    }

    const nuevoDevuelto = devuelto - montoViejo + monto;
    // Defensivo: con D-7 consistente (devuelto = Σ entregas) no puede
    // negarse; protege ante datos divergentes (H-a).
    if (nuevoDevuelto < 0) {
      throw new ReintegroError(
        "VALIDACION",
        "El nuevo importe dejaría el saldo global en negativo.",
      );
    }
    // PO-7/DC-2: saldo resultante sin sobrepago.
    if (nuevoDevuelto > montoObl) {
      throw new ReintegroError(
        "SALDO_INSUFICIENTE",
        `El nuevo importe supera el saldo permitido (${montoObl - devuelto + montoViejo}).`,
      );
    }

    // Rama (ii): SOLO cambia `monto`; el delta de `devuelto` cae en la
    // rama (a) si sube o (b) si baja — ambas con hasOnly(['devuelto']).
    tx.update(entRef, { monto });
    tx.update(oblRef, { devuelto: nuevoDevuelto });

    // Bitácora D-3: evento edicion/entrega en la misma transacción.
    tx.set(doc(collection(db, "reintegros", rid, "eventos")), {
      registradoPor: uid,
      tipo: "edicion",
      entidad: "entrega",
      entregaId: did,
      montoAnterior: montoViejo,
      montoNuevo: monto,
      createdAt: serverTimestamp(),
    });
  });
}
