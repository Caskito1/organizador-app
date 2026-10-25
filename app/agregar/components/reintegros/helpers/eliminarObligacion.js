// agregar/components/reintegros/helpers/eliminarObligacion.js
// 4.3-bis — Eliminación lógica de una obligación (E1 + DC-7): transacción
// que agrega la constancia `eliminacion` (quién, cuándo, motivo opcional)
// y el evento `eliminacion`/`obligacion`. SOLO el registrador (matriz D-8
// E1; reglas rama (f)) — guardia de cliente para error limpio, las reglas
// re-verifican. One-shot: una sola eliminación (I-11; rama (f) + guard
// global de reglas). Conserva el doc original y sus entregas SIN borrado
// en cascada (I-4/I-10): las entregas quedan como histórico; la UI las
// excluye porque solo se leen para obligaciones visibles. CERRADAS no se
// eliminan (regla estricta 24/10/2026): CONDONADA y LIQUIDADA se rechazan
// con guarda de cliente y error limpio — D-9 opción B (eliminar perdonada,
// elegida 16/10/2026) quedó RETIRADA el 24/10/2026. Barrera de cliente: la
// rama (f) de reglas no bloquea estos estados (reglas sin cambios). Recibe
// `db` como parámetro: el harness pasa la instancia del emulador; la app
// pasa `db` de @/lib/firebase.

import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { ReintegroError } from "./submitDevolucion.js";

export async function eliminarObligacion({ db, uid, rid, motivo = null }) {
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
    // I-11 / doble eliminación: un registro eliminado es inmutable y no se
    // re-elimina.
    if ("eliminacion" in obl) {
      throw new ReintegroError(
        "ELIMINADA",
        "Esta obligación ya fue eliminada.",
      );
    }
    // E1 (D-8): solo el registrador elimina. Guardia de cliente para error
    // limpio; las reglas re-verifican esRegistrador.
    if (obl.registradoPor !== uid) {
      throw new ReintegroError(
        "NO_REGISTRADOR",
        "Solo quien registró la obligación puede eliminarla.",
      );
    }
    // Cerradas no se eliminan (regla estricta 24/10/2026; D-9 opción B
    // RETIRADA): ni perdonada ni liquidada admite eliminación. Guardias de
    // cliente para error limpio — la rama (f) de reglas no las bloquea.
    if ("condonacion" in obl) {
      throw new ReintegroError(
        "CONDONADA",
        "Obligación perdonada: no admite eliminación.",
      );
    }
    const saldo = Number(obl.monto || 0) - Number(obl.devuelto || 0);
    if (saldo <= 0) {
      throw new ReintegroError(
        "LIQUIDADA",
        "Obligación liquidada: no admite eliminación.",
      );
    }

    // Solo se AGREGA `eliminacion` (hasOnly(['eliminacion']) en reglas):
    // monto, devuelto y constancias intactos.
    tx.update(oblRef, {
      eliminacion: {
        eliminadaPor: uid,
        createdAt: serverTimestamp(),
        motivo: motivo || null,
      },
    });
    tx.set(doc(collection(db, "reintegros", rid, "eventos")), {
      registradoPor: uid,
      tipo: "eliminacion",
      entidad: "obligacion",
      monto: Number(obl.monto || 0),
      devuelto: Number(obl.devuelto || 0),
      motivo: motivo || null,
      createdAt: serverTimestamp(),
    });
  });
}
