// agregar/components/reintegros/helpers/editarFechaObligacion.js
// 5.0-fecha — Edición de la FECHA de una obligación (U-2: operación
// INDEPENDIENTE de la edición de monto). Transacción que cambia SOLO el campo
// `fecha` (hasOnly(['fecha']) en las reglas) y registra el evento
// `edicion/fecha` con fechaAnterior y fechaNueva (celda nueva del esquema
// canónico, dominio.md §5.3). SOLO el registrador (esRegistrador en reglas) y
// SOLO con devuelto == 0 (F-5): con pagos registrados la fecha queda bloqueada,
// igual que el monto (D-8(ii)). Guardas de cliente: eliminada/condonada no se
// editan (las reglas también las bloquean). `createdAt` NO se toca (F-4).
// Recibe `db` como parámetro: el harness pasa la instancia del emulador; la
// app pasa `db` de @/lib/firebase.

import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
// Helper puro compartido con gastos/ingresos. Import RELATIVO con extensión:
// este archivo también lo carga el harness con node --test (sin alias `@/`).
import {
  fechaLocal,
  isoDeFecha,
} from "../../../../gastos/helpers/dateHelpers.js";
import { ReintegroError } from "./submitDevolucion.js";

// 'YYYY-MM-DD' → Timestamp a medianoche LOCAL. Misma convención que
// submitReintegro/DevolucionModal: un parseo UTC correría el día —y el mes—
// en el borde. El rollover de Date (2026-02-31 → 03/03) es error.
function fechaATimestamp(iso) {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new ReintegroError("FECHA_INVALIDA", `fecha inválida: ${String(iso)}`);
  }
  const [y, m, d] = iso.split("-").map(Number);
  const local = fechaLocal(iso);
  if (
    Number.isNaN(local.getTime()) ||
    local.getFullYear() !== y ||
    local.getMonth() !== m - 1 ||
    local.getDate() !== d
  ) {
    throw new ReintegroError("FECHA_INVALIDA", `fecha inválida: ${iso}`);
  }
  return Timestamp.fromDate(local);
}

export async function editarFechaObligacion({ db, uid, rid, fechaISO }) {
  const fechaNueva = fechaATimestamp(fechaISO);

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
    // F-5: solo el registrador edita la fecha. Guardia de cliente para un
    // error limpio; las reglas re-verifican esRegistrador.
    if (obl.registradoPor !== uid) {
      throw new ReintegroError(
        "NO_REGISTRADOR",
        "Solo quien registró la obligación puede editar su fecha.",
      );
    }

    const devuelto = Number(obl.devuelto || 0);
    // F-5 / D-8(ii): la fecha editable SOLO con devuelto == 0 (sin pagos).
    // Cubre también el caso liquidado (devuelto == monto > 0).
    if (devuelto > 0) {
      throw new ReintegroError(
        "FECHA_BLOQUEADA",
        "Ya hay pagos registrados: la fecha solo se edita con $0 devuelto.",
      );
    }

    // P-4: «sin cambios» se evalúa por DÍA contra la fecha EFECTIVA
    // (`fecha` o, en documentos viejos, `createdAt`): si el día no cambia no
    // hay nada que guardar (espejo del `monto != resource.data.monto`).
    const fechaAnterior = obl.fecha ?? null;
    if (isoDeFecha(fechaAnterior ?? obl.createdAt) === fechaISO) {
      throw new ReintegroError(
        "FECHA_SIN_CAMBIOS",
        "La fecha es igual a la actual: no hay nada que guardar.",
      );
    }

    // Rama (g) de las reglas: SOLO cambia `fecha`; createdAt y el resto del
    // documento quedan congelados.
    tx.update(oblRef, { fecha: fechaNueva });

    // Bitácora D-3 / 5.0-fecha: evento edicion/fecha en la misma transacción.
    // `fechaAnterior` se escribe null explícito cuando el documento no tenía
    // el campo (Capa 3 de §5.3: «no había fecha», no se inventa una).
    tx.set(doc(collection(db, "reintegros", rid, "eventos")), {
      registradoPor: uid,
      tipo: "edicion",
      entidad: "fecha",
      fechaAnterior,
      fechaNueva,
      createdAt: serverTimestamp(),
    });
  });
}
