// reintegros/services/subscribeReintegros.js
// Suscripción bilateral R1' (reintegros) + D1 (devoluciones, batching TANDA).
// Recibe `db` como parámetro (no importa la config de Firebase):
// el harness pasa la instancia del emulador; la app pasa `db` de @/lib/firebase.

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

// Límite del filtro `in` en Firestore (SDK web). El cliente no lo excede.
export const TANDA = 10;

export function subscribeReintegros({ db, uid, onData, onError }) {
  let oblUnsub = null;
  let tandaUnsubs = [];
  let destroyed = false;
  let prevRidKey = null;

  let obligaciones = [];
  let devoluciones = [];
  let oblLoaded = false;
  let devsLoaded = false;

  function emit() {
    if (destroyed) return;
    if (!oblLoaded || !devsLoaded) return;
    onData({ obligaciones, devoluciones });
  }

  // serverTimestamps: "estimate" resuelve createdAt/fechaPago pendientes
  // (escritura local aún no confirmada por el servidor) a un Timestamp
  // estimado en vez de null — los cálculos por mes no se rompen.
  function mapDocs(snap) {
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data({ serverTimestamps: "estimate" }),
    }));
  }

  function resubscribeDevoluciones(rids, snap) {
    if (destroyed) return;

    // Solo resuscribir si el CONJUNTO de rids cambió. R1' re-emite ante
    // cambios en docs que no alteran la lista de ids (p. ej. editar el
    // monto o el concepto): sin este guard, cada re-emisión desuscribe y
    // resuscribe D1, reseteando devoluciones a [] y forzando un ciclo de
    // carga nuevo. BUG LATENTE (4.1, destapado 21/10/2026 en validar 4.3b):
    // el guard hacía `return` SIN emitir, así que un cambio de campos de
    // obligaciones (monto editado) que no tocaba D1 nunca llegaba a la UI
    // (fila/balance/header quedaban con el valor viejo). Ahora, si el
    // conjunto no cambió pero SÍ hay docChanges reales, se publica igual.
    const ridKey = rids.length === 0 ? "" : [...rids].sort().join(",");
    if (ridKey === prevRidKey) {
      if (snap?.docChanges()?.length > 0) emit();
      return;
    }
    prevRidKey = ridKey;

    // Desuscribir tandas previas cuando el conjunto de rids cambió.
    tandaUnsubs.forEach((u) => u());
    tandaUnsubs = [];
    devoluciones = [];
    devsLoaded = false;

    // Nunca suscribir D1 con lista vacía (el filtro `in` la rechazaría).
    if (rids.length === 0) {
      devsLoaded = true;
      emit();
      return;
    }

    const tandas = [];
    for (let i = 0; i < rids.length; i += TANDA) {
      tandas.push(rids.slice(i, i + TANDA));
    }

    const tandaDocs = new Map(); // idx de tanda → docs
    const loadedIdx = new Set();

    tandas.forEach((tanda, idx) => {
      const q = query(
        collection(db, "reintegro_devoluciones"),
        where("reintegroId", "in", tanda),
      );
      const unsub = onSnapshot(
        q,
        (snap) => {
          tandaDocs.set(idx, mapDocs(snap));
          loadedIdx.add(idx);
          const all = [];
          tandaDocs.forEach((docs) => all.push(...docs));
          devoluciones = all;
          if (loadedIdx.size >= tandas.length) {
            devsLoaded = true;
            emit();
          }
        },
        onError,
      );
      tandaUnsubs.push(unsub);
    });
  }

  // R1': obligaciones propias y en espejo (participantes array-contains uid).
  // Sin filtro de mes: la lista muestra el stock global (PO-1).
  const r1Query = query(
    collection(db, "reintegros"),
    where("participantes", "array-contains", uid),
    orderBy("createdAt", "desc"),
  );

  oblUnsub = onSnapshot(
    r1Query,
    (snap) => {
      obligaciones = mapDocs(snap);
      oblLoaded = true;
      resubscribeDevoluciones(obligaciones.map((o) => o.id), snap);
    },
    onError,
  );

  return () => {
    destroyed = true;
    oblUnsub?.();
    tandaUnsubs.forEach((u) => u());
  };
}
