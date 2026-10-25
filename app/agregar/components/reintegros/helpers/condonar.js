// agregar/components/reintegros/helpers/condonar.js
// 4.3-bis — Condonación de una obligación (C1 + DC-8): transacción que
// agrega la constancia `condonacion` (quién, cuándo, motivo opcional) y el
// evento `condonacion`/`obligacion`. SOLO el ACREEDOR según su vista
// (matriz D-8 C1; reglas rama (e)): externo → solo el registrador; miembro
// → espejo según sentido (el que adelantó `por_cobrar`, o la contraparte
// cuando el registrador es el deudor `por_devolver`). Guardia de cliente
// para error limpio; las reglas re-verifican esAcreedor. One-shot: una
// sola condonación (rama (e) + guarda de cliente). La condonación NO es un
// pago (I-12): no crea entrega, no incrementa `devuelto` ni el dinero
// recibido; las entregas existentes quedan congeladas (D-9). La UI etiqueta
// esta acción «Perdonar deuda» con sello «Perdonada» (decisión 4.3-bis);
// el campo del modelo y el tipo de evento siguen siendo `condonacion`.
// Guardia de cliente LIQUIDADA (decisión 4.3-bis): perdonar se ofrece solo
// sobre obligaciones abiertas — la rama (e) de reglas no la bloquea.
// Recibe `db` como parámetro: el harness pasa la instancia del emulador;
// la app pasa `db` de @/lib/firebase.

import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { ReintegroError } from "./submitDevolucion.js";

export async function condonar({ db, uid, rid, motivo = null }) {
  if (motivo != null && typeof motivo !== "string") {
    throw new ReintegroError("VALIDACION", "motivo debe ser string o null");
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
    // One-shot: una sola condonación (espejo de la rama (e)).
    if ("condonacion" in obl) {
      throw new ReintegroError(
        "CONDONADA",
        "Esta obligación ya fue perdonada.",
      );
    }
    // C1 (D-8): solo el acreedor según su vista. EXTERNO (contraparteUid
    // == null): solo el registrador — la lógica de espejo no aplica (no hay
    // segunda parte en la app). MIEMBRO: espejo según sentido.
    const esAcreedor =
      obl.contraparteUid == null
        ? obl.registradoPor === uid
        : obl.registradoPor === uid
          ? obl.sentido === "por_cobrar"
          : (obl.participantes || []).includes(uid) &&
            obl.sentido === "por_devolver";
    if (!esAcreedor) {
      throw new ReintegroError(
        "NO_ACREEDOR",
        "Solo quien tiene que cobrar esta deuda puede perdonarla.",
      );
    }
    // Guardia de cliente LIQUIDADA (decisión 4.3-bis): perdonar se ofrece
    // solo sobre obligaciones abiertas. Barrera de cliente — la rama (e)
    // de reglas no la bloquea.
    const saldo = Number(obl.monto || 0) - Number(obl.devuelto || 0);
    if (saldo <= 0) {
      throw new ReintegroError(
        "LIQUIDADA",
        "Obligación liquidada: no hay deuda que perdonar.",
      );
    }

    // Solo se AGREGA `condonacion` (hasOnly(['condonacion']) en reglas):
    // devuelto, monto y entregas intactos (I-12).
    tx.update(oblRef, {
      condonacion: {
        condonadaPor: uid,
        createdAt: serverTimestamp(),
        motivo: motivo || null,
      },
    });
    tx.set(doc(collection(db, "reintegros", rid, "eventos")), {
      registradoPor: uid,
      tipo: "condonacion",
      entidad: "obligacion",
      monto: Number(obl.monto || 0),
      devuelto: Number(obl.devuelto || 0),
      motivo: motivo || null,
      createdAt: serverTimestamp(),
    });
  });
}
