// tarjetas/services/tarjetas.js
// 6.1 — ADAPTADOR de persistencia de la tarjeta en `users/{uid}.tarjetas`.
//
// Plan: PROPUESTA-ETAPA-6.md §11.5/§11.7. Recibe `db` por parámetro (la app
// pasa el de @/lib/firebase; el harness el del emulador). Lee con `getDoc` y
// escribe con `runTransaction` (read-modify-write atómico; offline falla, igual
// que el alta de reintegros).
//
// BORRADOS: `set(..., { merge: true })` NO elimina claves. Acá se usa
// `tx.update(ref, { tarjetas: nuevo })`, que REEMPLAZA el campo `tarjetas`
// (refleja los borrados) y PRESERVA el resto del doc (`balances`, `uid`, etc.).
//
// DEFENSA EN PROFUNDIDAD (nota): la restricción de editar solo compras "nuevas"
// (cuota 1/n en un ciclo sin verificar) es de 6.2. Este servicio no la impone.

import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import {
  TarjetasError,
  conApertura,
  conAperturaEditada,
  conCompra,
  conCompraEditada,
  conConfig,
  conEstado,
  conPago,
  normalizarTarjetas,
  nuevoId,
  sinApertura,
  sinCompra,
  sinPago,
  sinTarjeta,
  validarApertura,
  validarCicloKey,
  validarCompra,
  validarConfig,
  validarEstado,
  validarMonedaPago,
  validarPago,
  validarTarjetaId,
} from "../helpers/persistencia.js";

const COLECCION = "users";

function refUsuario(db, uid) {
  return doc(db, COLECCION, uid);
}

// Lectura one-shot. Sin suscripción (6.2 decide si refresca al volver a la pestaña).
export async function leerTarjetas({ db, uid } = {}) {
  if (!uid) {
    throw new TarjetasError("UID_REQUERIDO", "Falta el usuario.");
  }

  try {
    const snap = await getDoc(refUsuario(db, uid));

    if (!snap.exists()) return { existe: false, tarjetas: {} };

    return {
      existe: true,
      tarjetas: normalizarTarjetas(snap.data()?.tarjetas),
    };
  } catch (causa) {
    throw new TarjetasError("LECTURA_FALLIDA", "No pudimos leer las tarjetas.", {
      causa,
    });
  }
}

// read-modify-write atómico: exige que `users/{uid}` exista (PERFIL_FALTANTE),
// aplica la transformación pura y REEMPLAZA el campo `tarjetas`.
async function mutar({ db, uid, tarjetaId, aplicar }) {
  if (!uid) {
    throw new TarjetasError("UID_REQUERIDO", "Falta el usuario.");
  }

  const ref = refUsuario(db, uid);

  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);

      if (!snap.exists()) {
        throw new TarjetasError(
          "PERFIL_FALTANTE",
          "Falta tu perfil de usuario: no se pueden guardar las tarjetas.",
        );
      }

      const actual = normalizarTarjetas(snap.data()?.tarjetas);
      const { tarjetas, resultado } = aplicar(actual);

      // Auditoría: updatedAt en la tarjeta afectada, si sigue existiendo.
      const nuevo = { ...tarjetas };
      if (tarjetaId && nuevo[tarjetaId]) {
        nuevo[tarjetaId] = { ...nuevo[tarjetaId], updatedAt: serverTimestamp() };
      }

      tx.update(ref, { tarjetas: nuevo });

      return resultado;
    });
  } catch (error) {
    if (error instanceof TarjetasError) throw error;

    throw new TarjetasError("ESCRITURA_FALLIDA", "No pudimos guardar las tarjetas.", {
      causa: error,
    });
  }
}

// ── config ────────────────────────────────────────────────────────────────

export async function guardarTarjeta({ db, uid, tarjetaId, config } = {}) {
  const id = validarTarjetaId(tarjetaId);
  const cfg = validarConfig(config);

  const tarjeta = await mutar({
    db,
    uid,
    tarjetaId: id,
    aplicar: (actual) => {
      const r = conConfig(actual, id, cfg, { creadaEn: serverTimestamp() });
      return { tarjetas: r.tarjetas, resultado: r.tarjeta };
    },
  });

  return { tarjetaId: id, tarjeta };
}

export async function eliminarTarjeta({ db, uid, tarjetaId } = {}) {
  const id = validarTarjetaId(tarjetaId);

  const tarjeta = await mutar({
    db,
    uid,
    tarjetaId: id,
    aplicar: (actual) => {
      const r = sinTarjeta(actual, id);
      return { tarjetas: r.tarjetas, resultado: r.tarjeta };
    },
  });

  return { tarjetaId: id, tarjeta };
}

// ── compras ───────────────────────────────────────────────────────────────

export async function agregarCompra({ db, uid, tarjetaId, compra } = {}) {
  const id = validarTarjetaId(tarjetaId);
  const validada = validarCompra(compra);
  const compraId = nuevoId();
  // Firestore NO admite serverTimestamp() dentro de un array (las compras son
  // un array): el createdAt de la compra es un Date de CLIENTE. Los timestamps
  // de nivel superior (tarjeta.createdAt/updatedAt) sí usan serverTimestamp().
  const completa = { id: compraId, ...validada, createdAt: new Date() };

  const guardada = await mutar({
    db,
    uid,
    tarjetaId: id,
    aplicar: (actual) => {
      const r = conCompra(actual, id, completa);
      return { tarjetas: r.tarjetas, resultado: r.compra };
    },
  });

  return { compraId, compra: guardada };
}

export async function editarCompra({ db, uid, tarjetaId, compraId, cambios } = {}) {
  const id = validarTarjetaId(tarjetaId);

  const compra = await mutar({
    db,
    uid,
    tarjetaId: id,
    aplicar: (actual) => {
      const r = conCompraEditada(actual, id, compraId, cambios);
      return { tarjetas: r.tarjetas, resultado: r.compra };
    },
  });

  return { compra };
}

export async function eliminarCompra({ db, uid, tarjetaId, compraId } = {}) {
  const id = validarTarjetaId(tarjetaId);

  const compra = await mutar({
    db,
    uid,
    tarjetaId: id,
    aplicar: (actual) => {
      const r = sinCompra(actual, id, compraId);
      return { tarjetas: r.tarjetas, resultado: r.compra };
    },
  });

  return { compra };
}

// ── pagos ─────────────────────────────────────────────────────────────────

export async function guardarPago({ db, uid, tarjetaId, cicloKey, moneda, pago } = {}) {
  const id = validarTarjetaId(tarjetaId);
  const ciclo = validarCicloKey(cicloKey);
  const mon = validarMonedaPago(moneda);
  const validado = validarPago(pago);

  const guardado = await mutar({
    db,
    uid,
    tarjetaId: id,
    aplicar: (actual) => {
      const r = conPago(actual, id, ciclo, mon, validado);
      return { tarjetas: r.tarjetas, resultado: r.pago };
    },
  });

  return { pago: guardado };
}

export async function eliminarPago({ db, uid, tarjetaId, cicloKey, moneda } = {}) {
  const id = validarTarjetaId(tarjetaId);
  const ciclo = validarCicloKey(cicloKey);
  const mon = validarMonedaPago(moneda);

  const pago = await mutar({
    db,
    uid,
    tarjetaId: id,
    aplicar: (actual) => {
      const r = sinPago(actual, id, ciclo, mon);
      return { tarjetas: r.tarjetas, resultado: r.pago };
    },
  });

  return { pago };
}

// ── apertura ──────────────────────────────────────────────────────────────

export async function agregarApertura({ db, uid, tarjetaId, plan } = {}) {
  const id = validarTarjetaId(tarjetaId);
  const validado = validarApertura(plan);
  const planId = nuevoId();
  const completo = { id: planId, ...validado };

  const guardado = await mutar({
    db,
    uid,
    tarjetaId: id,
    aplicar: (actual) => {
      const r = conApertura(actual, id, completo);
      return { tarjetas: r.tarjetas, resultado: r.plan };
    },
  });

  return { planId, plan: guardado };
}

export async function editarApertura({ db, uid, tarjetaId, planId, cambios } = {}) {
  const id = validarTarjetaId(tarjetaId);

  const plan = await mutar({
    db,
    uid,
    tarjetaId: id,
    aplicar: (actual) => {
      const r = conAperturaEditada(actual, id, planId, cambios);
      return { tarjetas: r.tarjetas, resultado: r.plan };
    },
  });

  return { plan };
}

export async function eliminarApertura({ db, uid, tarjetaId, planId } = {}) {
  const id = validarTarjetaId(tarjetaId);

  const plan = await mutar({
    db,
    uid,
    tarjetaId: id,
    aplicar: (actual) => {
      const r = sinApertura(actual, id, planId);
      return { tarjetas: r.tarjetas, resultado: r.plan };
    },
  });

  return { plan };
}

// ── estados del ciclo ─────────────────────────────────────────────────────

export async function guardarEstadoCiclo({ db, uid, tarjetaId, cicloKey, estado } = {}) {
  const id = validarTarjetaId(tarjetaId);
  const ciclo = validarCicloKey(cicloKey);
  const est = validarEstado(estado);

  const guardado = await mutar({
    db,
    uid,
    tarjetaId: id,
    aplicar: (actual) => {
      const r = conEstado(actual, id, ciclo, est);
      return { tarjetas: r.tarjetas, resultado: r.estado };
    },
  });

  return { estado: guardado };
}
