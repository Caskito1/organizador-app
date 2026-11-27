// tarjetas/services/reintegroDeCompra.js
// 6.3 + 6.3-bis — Compra «Reintegro» ↔ obligación en `reintegros`.
//
// FUENTE ÚNICA: la compra (en `users/{uid}.tarjetas`) manda. Desde /tarjetas se
// editan monto, detalle, nombre del tercero, cuotas y fecha; /reintegros solo
// opera la deuda (cobros, saldar, condonar). Cada cambio de la compra se
// sincroniza a la obligación en LA MISMA transacción.
//
// Reglas de sincronización (sin cambios de reglas):
//   · monto  → update #1 (rama c: registrador, devuelto == 0, sin condonación).
//   · detalle/nombre → update #2 (rama d: hasOnly concepto/contraparteNombre/
//     registradoPorNombre). Son DOS escrituras separadas a propósito:
//     `affectedKeys` se evalúa por escritura.
//
// La guarda `CICLO_BLOQUEADO` de 6.2-bis se aplica acá también.

import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

import { aDate } from "../../gastos/helpers/dateHelpers.js";
import { etiquetaCiclo } from "../helpers/ciclo.js";
import {
  cicloActualDe,
  cicloPendiente,
  compraBloqueada,
} from "../helpers/pendiente.js";
import {
  CONCEPTO_POR_DEFECTO,
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

const CAMPOS_NO_EDITABLES = [
  "id",
  "createdAt",
  "gastoVinculadoId",
  "tipo",
  "moneda",
];

function refUsuario(db, uid) {
  return doc(db, COLECCION, uid);
}

function conceptoDe(detalle) {
  const limpio = typeof detalle === "string" ? detalle.trim() : "";
  return limpio || CONCEPTO_POR_DEFECTO;
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

function compraNoEncontrada(compraId) {
  return new TarjetasError(
    "COMPRA_NO_ENCONTRADA",
    `No existe la compra ${String(compraId)}.`,
  );
}

function errorPendiente(pendiente) {
  return new TarjetasError(
    "CICLO_BLOQUEADO",
    `Hay una factura pendiente (${etiquetaCiclo(pendiente) ?? pendiente}) sin cerrar o sin pagar. Resolvela antes de operar ciclos posteriores.`,
  );
}

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

// Los campos inmutables solo se rechazan si CAMBIAN: el modal de edición envía
// el tipo/moneda actuales (read-only) y deben poder viajar sin romper.
function validarCambiosInmutables(compraActual, cambios) {
  const alterados = CAMPOS_NO_EDITABLES.some((campo) => {
    if (!cambios || !(campo in cambios)) return false;
    if (campo === "id" || campo === "createdAt") return true;
    return cambios[campo] !== compraActual[campo];
  });

  if (alterados) {
    throw new TarjetasError(
      "COMPRA_INVALIDA",
      "El tipo, la moneda y el vínculo se definen en el alta y no se editan.",
    );
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

function eventoCreacion(uid, monto, sentido) {
  return {
    registradoPor: uid,
    tipo: "creacion",
    entidad: "obligacion",
    monto,
    sentido,
    createdAt: serverTimestamp(),
  };
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
  const validada = validarCompra({
    ...compra,
    contraparteNombre: contraparteNombre ?? compra?.contraparteNombre,
  });
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
    contraparteNombre: contraparteNombre ?? completa.contraparteNombre,
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
      tx.set(
        doc(db, "reintegros", idReintegro, "eventos", nuevoId()),
        eventoCreacion(uid, payload.monto, payload.sentido),
      );

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

// ── edición (fuente única) ────────────────────────────────────────────────

export async function editarCompraVinculada({
  db,
  uid,
  tarjetaId,
  compraId,
  cambios,
  ahora = new Date(),
} = {}) {
  const id = validarTarjetaId(tarjetaId);
  const ref = refUsuario(db, uid);

  // Pre-lectura (sin transacción): validar y capturar los valores viejos para
  // la compensación.
  let snap;
  try {
    snap = await getDoc(ref);
  } catch (error) {
    throw new TarjetasError(
      "LECTURA_FALLIDA",
      "No pudimos leer la tarjeta.",
      { causa: error },
    );
  }
  if (!snap.exists()) throw perfilFaltante();

  const actual = normalizarTarjetas(snap.data()?.tarjetas);
  const tarjeta = actual[id];
  if (!tarjeta) throw tarjetaNoEncontrada(id);

  const compraActual = (tarjeta.compras ?? []).find(
    (item) => item.id === compraId,
  );
  if (!compraActual) throw compraNoEncontrada(compraId);

  validarCambiosInmutables(compraActual, cambios);

  const fusion = { ...compraActual, ...(cambios ?? {}) };
  bloquearCompra(tarjeta, ahora, fusion);

  const r = conCompraEditada(actual, id, compraId, cambios);
  const nuevaCompra = r.compra;

  const rid = compraActual.gastoVinculadoId;
  let obl = null;
  let oblRef = null;

  if (rid) {
    oblRef = doc(db, "reintegros", rid);
    let oblSnap;
    try {
      oblSnap = await getDoc(oblRef);
    } catch (error) {
      throw new TarjetasError(
        "LECTURA_FALLIDA",
        "No pudimos leer el reintegro vinculado.",
        { causa: error },
      );
    }
    if (!oblSnap.exists()) {
      throw new TarjetasError(
        "OBLIGACION_NO_ENCONTRADA",
        "No se encontró el reintegro vinculado.",
      );
    }
    obl = oblSnap.data();
  }

  const montoNuevo = nuevaCompra.monto;
  const cambiaMonto = !!obl && montoNuevo !== Number(compraActual.monto);
  const conceptoNuevo = conceptoDe(nuevaCompra.detalle);
  const cambiaConcepto = !!obl && conceptoNuevo !== obl.concepto;
  const nombreNuevo = nuevaCompra.contraparteNombre;
  const cambiaNombre =
    !!obl && !!nombreNuevo && nombreNuevo !== obl.contraparteNombre;

  if (obl) {
    const cerrada = "condonacion" in obl || "eliminacion" in obl;

    if (cambiaMonto) {
      if (cerrada) {
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
    }
    if ((cambiaConcepto || cambiaNombre) && cerrada) {
      throw new TarjetasError(
        "OBLIGACION_CERRADA",
        "El reintegro vinculado está cerrado; no se puede editar desde Tarjetas.",
      );
    }
  }

  // ALTERNATIVA B: escrituras secuenciales (no atómicas; las ramas hasOnly de
  // reglas son excluyentes y Firestore fusiona affectedKeys por doc/commit).
  // Orden: (a) monto [la única que puede fallar por reglas], (b) concepto/
  // nombre, (c) compra. Compensación best-effort si (b) o (c) fallan.
  let montoAplicado = false;
  let conceptosAplicados = false;
  let resultado = null;

  try {
    // (a) monto de la obligación.
    if (obl && cambiaMonto) {
      await runTransaction(db, async (tx) => {
        const os = await tx.get(oblRef);
        if (!os.exists()) {
          throw new TarjetasError(
            "OBLIGACION_NO_ENCONTRADA",
            "No se encontró el reintegro vinculado.",
          );
        }
        const o = os.data();
        if ("condonacion" in o || "eliminacion" in o) {
          throw new TarjetasError(
            "OBLIGACION_CERRADA",
            "El reintegro vinculado ya está cerrado; no se puede cambiar el monto.",
          );
        }
        if (Number(o.devuelto || 0) > 0) {
          throw new TarjetasError(
            "MONTO_BLOQUEADO",
            "Ya hay cobros registrados: no se puede cambiar el monto.",
          );
        }

        tx.update(oblRef, { monto: montoNuevo });
        tx.set(doc(db, "reintegros", rid, "eventos", nuevoId()), {
          registradoPor: uid,
          tipo: "edicion",
          entidad: "obligacion",
          montoAnterior: Number(o.monto || 0),
          montoNuevo,
          createdAt: serverTimestamp(),
        });
      });
      montoAplicado = true;
    }

    // (b) concepto / nombre de la obligación.
    if (obl && (cambiaConcepto || cambiaNombre)) {
      await runTransaction(db, async (tx) => {
        const os = await tx.get(oblRef);
        if (!os.exists()) {
          throw new TarjetasError(
            "OBLIGACION_NO_ENCONTRADA",
            "No se encontró el reintegro vinculado.",
          );
        }
        const o = os.data();
        if ("condonacion" in o || "eliminacion" in o) {
          throw new TarjetasError(
            "OBLIGACION_CERRADA",
            "El reintegro vinculado está cerrado; no se puede editar desde Tarjetas.",
          );
        }

        const cambiosObligacion = {};
        if (cambiaConcepto) cambiosObligacion.concepto = conceptoNuevo;
        if (cambiaNombre) cambiosObligacion.contraparteNombre = nombreNuevo;

        tx.update(oblRef, cambiosObligacion);
      });
      conceptosAplicados = true;
    }

    // (c) la compra (fuente única).
    await runTransaction(db, async (tx) => {
      const su = await tx.get(ref);
      if (!su.exists()) throw perfilFaltante();

      const actualTx = normalizarTarjetas(su.data()?.tarjetas);
      const tarjetaTx = actualTx[id];
      if (!tarjetaTx) throw tarjetaNoEncontrada(id);

      const compraTx = (tarjetaTx.compras ?? []).find(
        (item) => item.id === compraId,
      );
      if (!compraTx) throw compraNoEncontrada(compraId);

      const fusionTx = { ...compraTx, ...(cambios ?? {}) };
      bloquearCompra(tarjetaTx, ahora, fusionTx);

      const rTx = conCompraEditada(actualTx, id, compraId, cambios);
      escribirTarjeta(tx, ref, rTx.tarjetas, id);
      resultado = rTx.compra;
    });
  } catch (error) {
    // Compensación best-effort: revertir lo aplicado, en orden inverso.
    if (montoAplicado) {
      try {
        await updateDoc(oblRef, { monto: Number(obl.monto || 0) });
      } catch {
        // best-effort: si no se puede revertir, queda el monto nuevo.
      }
    }
    if (conceptosAplicados) {
      try {
        const revertir = {};
        if (cambiaConcepto) revertir.concepto = obl.concepto;
        if (
          cambiaNombre &&
          typeof obl.contraparteNombre === "string" &&
          obl.contraparteNombre
        ) {
          revertir.contraparteNombre = obl.contraparteNombre;
        }
        if (Object.keys(revertir).length) {
          await updateDoc(oblRef, revertir);
        }
      } catch {
        // best-effort
      }
    }

    if (error instanceof TarjetasError) throw error;
    throw new TarjetasError(
      "ESCRITURA_FALLIDA",
      "No pudimos editar la compra. Se intentó revertir lo aplicado.",
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
      if (!compra) throw compraNoEncontrada(compraId);

      bloquearCompra(tarjeta, ahora, compra);

      const rid = compra.gastoVinculadoId;
      if (rid) {
        const oblRef = doc(db, "reintegros", rid);
        const oblSnap = await tx.get(oblRef);

        if (oblSnap.exists()) {
          const obl = oblSnap.data();

          if (!("eliminacion" in obl)) {
            if ("condonacion" in obl) {
              throw new TarjetasError(
                "OBLIGACION_CERRADA",
                "El reintegro vinculado está perdonado; no se puede eliminar la compra.",
              );
            }
            // Barrera de CLIENTE (las reglas no exigen devuelto == 0).
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

// ── lectura de vínculos (para avisos y prefill) ───────────────────────────

export async function leerVinculos({ db, rids = [] } = {}) {
  const salida = {};
  const unicos = [
    ...new Set((rids ?? []).filter((rid) => typeof rid === "string" && rid)),
  ];

  await Promise.all(
    unicos.map(async (rid) => {
      try {
        const snap = await getDoc(doc(db, "reintegros", rid));
        if (!snap.exists()) {
          salida[rid] = { estado: "no_encontrada" };
          return;
        }
        const o = snap.data();
        salida[rid] = {
          estado: o.eliminacion ? "eliminada" : "activa",
          devuelto: Number(o.devuelto || 0),
          condonada: !!o.condonacion,
          contraparteNombre:
            typeof o.contraparteNombre === "string"
              ? o.contraparteNombre
              : null,
        };
      } catch {
        salida[rid] = { estado: "desconocido" };
      }
    }),
  );

  return salida;
}

// ── recrear el vínculo huérfano ───────────────────────────────────────────

export async function recrearReintegro({
  db,
  uid,
  uidNombre,
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
      if (!compra) throw compraNoEncontrada(compraId);
      if (compra.tipo !== "reintegro" || !compra.gastoVinculadoId) {
        throw new TarjetasError(
          "REINTEGRO_INVALIDO",
          "La compra no tiene un reintegro vinculado para recrear.",
        );
      }

      const ridViejo = compra.gastoVinculadoId;
      const viejoRef = doc(db, "reintegros", ridViejo);
      const viejoSnap = await tx.get(viejoRef);
      if (!viejoSnap.exists()) {
        throw new TarjetasError(
          "OBLIGACION_NO_ENCONTRADA",
          "No se encontró la obligación vinculada.",
        );
      }
      const viejo = viejoSnap.data();
      if (!("eliminacion" in viejo)) {
        throw new TarjetasError(
          "OBLIGACION_CERRADA",
          "El reintegro vinculado no está eliminado: no hay nada que recrear.",
        );
      }
      if (Number(viejo.devuelto || 0) > 0) {
        throw new TarjetasError(
          "REVISION_MANUAL",
          "El vínculo eliminado tiene cobros registrados: requiere revisión manual.",
        );
      }

      bloquearCompra(tarjeta, ahora, compra);

      const ridNuevo = nuevoId();
      const nombre =
        compra.contraparteNombre || viejo.contraparteNombre || null;
      const completa = {
        ...compra,
        gastoVinculadoId: ridNuevo,
        contraparteNombre: nombre,
      };
      const payload = obligacionDeCompra({
        uid,
        uidNombre,
        compra: completa,
        contraparteNombre: nombre,
      });
      const fecha = aDate(payload.fecha);
      if (!fecha) {
        throw new TarjetasError(
          "REINTEGRO_INVALIDO",
          "Fecha de la compra inválida.",
        );
      }

      tx.set(doc(db, "reintegros", ridNuevo), {
        registradoPor: uid,
        ...payload,
        devuelto: 0,
        fecha: Timestamp.fromDate(fecha),
        createdAt: serverTimestamp(),
      });
      tx.set(
        doc(db, "reintegros", ridNuevo, "eventos", nuevoId()),
        eventoCreacion(uid, payload.monto, payload.sentido),
      );

      const r = conCompraEditada(actual, id, compraId, {
        gastoVinculadoId: ridNuevo,
        contraparteNombre: nombre,
      });
      escribirTarjeta(tx, ref, r.tarjetas, id);
      resultado = r.compra;
    });
  } catch (error) {
    if (error instanceof TarjetasError) throw error;
    throw new TarjetasError(
      "ESCRITURA_FALLIDA",
      "No pudimos recrear el reintegro. No se guardó nada.",
      { causa: error },
    );
  }

  return { rid: resultado?.gastoVinculadoId ?? null, compra: resultado };
}
