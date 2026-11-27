// tarjetas/services/reintegroDeCompra.js
// 6.3 — Compra «Reintegro» ↔ obligación en `reintegros` (alta/baja/edición
// ATÓMICAS) con la guarda de factura pendiente de 6.2-bis.
//
// Plan: PROPUESTA-ETAPA-6.md §13.3.3–§13.3.5. Un solo `runTransaction` escribe
// `users/{uid}.tarjetas` + `reintegros/{rid}` + `reintegros/{rid}/eventos`, así
// que no puede quedar compra sin obligación ni al revés.
//
// La guarda `CICLO_BLOQUEADO` se aplica ACÁ (con la tarjeta leída dentro de la
// transacción), igual que en `services/tarjetas.js`: una pestaña vieja no puede
// saltear el bloqueo llamando a este servicio.

import {
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

import { aDate } from "../../gastos/helpers/dateHelpers.js";
import { etiquetaCiclo } from "../helpers/ciclo.js";
import {
  cicloActualDe,
  cicloPendiente,
  compraBloqueada,
} from "../helpers/pendiente.js";
import {
  MOTIVO_ELIMINACION,
  obligacionDeCompra,
} from "../helpers/obligacion.js";
import {
  TarjetasError,
  conCompra,
  conCompraEditada,
  normalizarTarjetas,
  nuevoId,
  sinCompra,
  validarCompra,
  validarTarjetaId,
} from "../helpers/persistencia.js";

const COLECCION = "users";

const CAMPOS_NO_EDITABLES = ["id", "createdAt", "gastoVinculadoId", "tipo", "moneda"];

function refUsuario(db, uid) {
  return doc(db, COLECCION, uid);
}

function perfilFaltante() {
  return new TarjetasError(
    "PERFIL_FALTANTE",
    "Falta tu perfil de usuario: no se pueden guardar las tarjetas.",
  );
}

function tarjetaNoEncontrada(id) {
  return new TarjetasError(
    "TARJETA_NO_ENCONTRADA",
    `No existe la tarjeta ${String(id)}.`,
  );
}

function errorPendiente(pendiente) {
  return new TarjetasError(
    "CICLO_BLOQUEADO",
    `Hay una factura pendiente (${etiquetaCiclo(pendiente) ?? pendiente}) sin cerrar o sin pagar. Resolvela antes de operar ciclos posteriores.`,
  );
}

// Misma guarda que services/tarjetas.js: bloquea si la compra toca un ciclo
// posterior al pendiente.
function bloquearCompra(tarjeta, ahora, compra) {
  const contexto = {
    compras: tarjeta.compras ?? [],
    apertura: tarjeta.apertura ?? [],
    ciclos: tarjeta.ciclos ?? {},
    cicloActual: cicloActualDe(tarjeta, ahora),
    diaCierre: tarjeta.diaCierre,
    diaVencimiento: tarjeta.diaVencimiento,
  };

  if (compraBloqueada({ ...contexto, compra })) {
    throw errorPendiente(cicloPendiente(contexto));
  }
}

function escribirTarjeta(tx, ref, tarjetas, id) {
  const nuevo = {
    ...tarjetas,
    [id]: { ...tarjetas[id], updatedAt: serverTimestamp() },
  };
  tx.update(ref, { tarjetas: nuevo });
}

async function leerContexto(tx, db, uid, tarjetaId) {
  const ref = refUsuario(db, uid);
  const snap = await tx.get(ref);
  if (!snap.exists()) throw perfilFaltante();

  const actual = normalizarTarjetas(snap.data()?.tarjetas);
  const tarjeta = actual[tarjetaId];
  if (!tarjeta) throw tarjetaNoEncontrada(tarjetaId);

  return { ref, actual, tarjeta };
}

// ── alta ──────────────────────────────────────────────────────────────────

export async function crearCompraConReintegro({
  db,
  uid,
  uidNombre,
  tarjetaId,
  compra,
  contraparteNombre,
  compraId,
  rid,
  ahora = new Date(),
} = {}) {
  const id = validarTarjetaId(tarjetaId);
  const validada = validarCompra(compra);
  if (validada.tipo !== "reintegro") {
    throw new TarjetasError(
      "REINTEGRO_INVALIDO",
      "El servicio solo crea obligaciones para compras de tipo reintegro.",
    );
  }
  const fecha = aDate(validada.fecha);
  if (!fecha) {
    throw new TarjetasError("REINTEGRO_INVALIDO", "Fecha de la compra inválida.");
  }

  const idCompra = compraId || nuevoId();
  const idReintegro = rid || nuevoId();
  const completa = {
    id: idCompra,
    ...validada,
    fecha,
    gastoVinculadoId: idReintegro,
  };
  const payload = obligacionDeCompra({
    uid,
    uidNombre,
    compra: completa,
    contraparteNombre,
  });
  const nuevaCompra = { ...completa, createdAt: new Date() };

  let resultado = null;

  try {
    await runTransaction(db, async (tx) => {
      const { ref, actual, tarjeta } = await leerContexto(tx, db, uid, id);
      bloquearCompra(tarjeta, ahora, nuevaCompra);

      const existente = (tarjeta.compras ?? []).find(
        (item) => item.id === idCompra,
      );
      if (existente) {
        // Reintento con los mismos ids: la transacción anterior commiteó
        // compra + obligación juntas. No se duplica nada.
        resultado = existente;
        return;
      }

      const r = conCompra(actual, id, nuevaCompra);
      escribirTarjeta(tx, ref, r.tarjetas, id);

      tx.set(doc(db, "reintegros", idReintegro), {
        registradoPor: uid,
        ...payload,
        devuelto: 0,
        fecha: Timestamp.fromDate(fecha),
        createdAt: serverTimestamp(),
      });

      tx.set(doc(db, "reintegros", idReintegro, "eventos", nuevoId()), {
        registradoPor: uid,
        tipo: "creacion",
        entidad: "obligacion",
        monto: payload.monto,
        sentido: payload.sentido,
        createdAt: serverTimestamp(),
      });

      resultado = nuevaCompra;
    });
  } catch (error) {
    if (error instanceof TarjetasError) throw error;
    throw new TarjetasError(
      "ESCRITURA_FALLIDA",
      "No pudimos guardar la compra y su reintegro. No se guardó nada.",
      { causa: error },
    );
  }

  return {
    compraId: idCompra,
    compra: resultado,
    rid: resultado?.gastoVinculadoId ?? idReintegro,
  };
}

// ── edición ───────────────────────────────────────────────────────────────

export async function editarCompraVinculada({
  db,
  uid,
  tarjetaId,
  compraId,
  cambios,
  ahora = new Date(),
} = {}) {
  const id = validarTarjetaId(tarjetaId);
  if (cambios && CAMPOS_NO_EDITABLES.some((campo) => campo in cambios)) {
    throw new TarjetasError(
      "COMPRA_INVALIDA",
      "El tipo, la moneda y el vínculo no se editan.",
    );
  }

  let resultado = null;

  try {
    await runTransaction(db, async (tx) => {
      const { ref, actual, tarjeta } = await leerContexto(tx, db, uid, id);
      const compraActual = (tarjeta.compras ?? []).find(
        (item) => item.id === compraId,
      );
      if (!compraActual) {
        throw new TarjetasError(
          "COMPRA_NO_ENCONTRADA",
          `No existe la compra ${String(compraId)}.`,
        );
      }

      const fusion = { ...compraActual, ...(cambios ?? {}) };
      bloquearCompra(tarjeta, ahora, fusion);

      const r = conCompraEditada(actual, id, compraId, cambios);
      const rid = compraActual.gastoVinculadoId;

      // Solo el MONTO se sincroniza (T-3): el concepto y el nombre de la
      // contraparte son fotografía del alta.
      if (rid && r.compra.monto !== Number(compraActual.monto)) {
        const oblRef = doc(db, "reintegros", rid);
        const oblSnap = await tx.get(oblRef);
        if (!oblSnap.exists()) {
          throw new TarjetasError(
            "OBLIGACION_NO_ENCONTRADA",
            "No se encontró el reintegro vinculado.",
          );
        }
        const obl = oblSnap.data();
        if ("condonacion" in obl || "eliminacion" in obl) {
          throw new TarjetasError(
            "OBLIGACION_CERRADA",
            "El reintegro vinculado ya está cerrado; no se puede cambiar el monto.",
          );
        }
        if (Number(obl.devuelto || 0) > 0) {
          throw new TarjetasError(
            "MONTO_BLOQUEADO",
            "Ya hay cobros registrados: no se puede cambiar el monto.",
          );
        }

        tx.update(oblRef, { monto: r.compra.monto });
        tx.set(doc(db, "reintegros", rid, "eventos", nuevoId()), {
          registradoPor: uid,
          tipo: "edicion",
          entidad: "obligacion",
          montoAnterior: Number(obl.monto || 0),
          montoNuevo: r.compra.monto,
          createdAt: serverTimestamp(),
        });
      }

      escribirTarjeta(tx, ref, r.tarjetas, id);
      resultado = r.compra;
    });
  } catch (error) {
    if (error instanceof TarjetasError) throw error;
    throw new TarjetasError(
      "ESCRITURA_FALLIDA",
      "No pudimos editar la compra. No se guardó nada.",
      { causa: error },
    );
  }

  return { compra: resultado };
}

// ── baja ──────────────────────────────────────────────────────────────────

export async function eliminarCompraVinculada({
  db,
  uid,
  tarjetaId,
  compraId,
  ahora = new Date(),
} = {}) {
  const id = validarTarjetaId(tarjetaId);
  let resultado = null;

  try {
    await runTransaction(db, async (tx) => {
      const { ref, actual, tarjeta } = await leerContexto(tx, db, uid, id);
      const compra = (tarjeta.compras ?? []).find(
        (item) => item.id === compraId,
      );
      if (!compra) {
        throw new TarjetasError(
          "COMPRA_NO_ENCONTRADA",
          `No existe la compra ${String(compraId)}.`,
        );
      }

      bloquearCompra(tarjeta, ahora, compra);

      const rid = compra.gastoVinculadoId;
      if (rid) {
        const oblRef = doc(db, "reintegros", rid);
        const oblSnap = await tx.get(oblRef);

        if (oblSnap.exists()) {
          const obl = oblSnap.data();

          // `allow delete: if false`: la obligación no se borra físicamente.
          // Si ya estaba eliminada, no se repite la constancia.
          if (!("eliminacion" in obl)) {
            if ("condonacion" in obl) {
              throw new TarjetasError(
                "OBLIGACION_CERRADA",
                "El reintegro vinculado está perdonado; no se puede eliminar la compra.",
              );
            }
            // Barrera de CLIENTE (las reglas no exigen devuelto == 0): se
            // bloquea cualquier cobro, total o parcial, porque acá se borra el
            // origen de la deuda.
            if (Number(obl.devuelto || 0) > 0) {
              throw new TarjetasError(
                "COMPRA_CON_COBROS",
                "No se puede eliminar: el reintegro ya tiene cobros registrados.",
              );
            }

            tx.update(oblRef, {
              eliminacion: {
                eliminadaPor: uid,
                createdAt: serverTimestamp(),
                motivo: MOTIVO_ELIMINACION,
              },
            });
            tx.set(doc(db, "reintegros", rid, "eventos", nuevoId()), {
              registradoPor: uid,
              tipo: "eliminacion",
              entidad: "obligacion",
              monto: Number(obl.monto || 0),
              devuelto: Number(obl.devuelto || 0),
              motivo: MOTIVO_ELIMINACION,
              createdAt: serverTimestamp(),
            });
          }
        }
      }

      const r = sinCompra(actual, id, compraId);
      escribirTarjeta(tx, ref, r.tarjetas, id);
      resultado = r.compra;
    });
  } catch (error) {
    if (error instanceof TarjetasError) throw error;
    throw new TarjetasError(
      "ESCRITURA_FALLIDA",
      "No pudimos eliminar la compra. No se guardó nada.",
      { causa: error },
    );
  }

  return { compra: resultado };
}
