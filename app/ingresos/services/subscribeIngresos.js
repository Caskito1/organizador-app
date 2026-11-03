// ingresos/services/subscribeIngresos.js

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export function subscribeIngresos({
  uid,
  selectedMonth,
  onData,
}) {
  const start = new Date(
    selectedMonth.getFullYear(),
    selectedMonth.getMonth(),
    1,
  );

  const end = new Date(
    selectedMonth.getFullYear(),
    selectedMonth.getMonth() + 1,
    1,
  );

  // 4.5-fecha: SIN rango por fecha en la query. El período se deriva en
  // cliente con `fechaEfectiva` (fecha ?? createdAt): un where("fecha", …)
  // excluiría los documentos históricos sin `fecha` (fallback roto).
  // Las transferencias conservan su rango por `createdAt` (sin cambios).
  const ingresosQuery = query(
    collection(db, "ingresos"),

    where("usuario", "==", uid),

    orderBy("createdAt", "desc"),
  );

  const transferenciasQuery = query(
    collection(db, "transferencias"),

    where(
      "paraUid",
      "==",
      uid,
    ),

    where(
      "createdAt",
      ">=",
      start,
    ),

    where(
      "createdAt",
      "<",
      end,
    ),

    orderBy("createdAt", "desc"),
  );

  let ingresos = [];

  let transferencias = [];

  let ingresosLoaded = false;

  let transferenciasLoaded = false;

  function emitIfReady() {
    if (
      ingresosLoaded &&
      transferenciasLoaded
    ) {
      onData({
        ingresos,
        transferencias,
      });
    }
  }

  const unsubIngresos =
    onSnapshot(
      ingresosQuery,
      (snap) => {
        ingresos = snap.docs.map(
          (doc) => ({
            id: doc.id,
            ...doc.data(),
          }),
        );

        ingresosLoaded = true;

        emitIfReady();
      },
    );

  const unsubTransferencias =
    onSnapshot(
      transferenciasQuery,
      (snap) => {
        transferencias =
          snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

        transferenciasLoaded = true;

        emitIfReady();
      },
    );

  return () => {
    unsubIngresos();
    unsubTransferencias();
  };
}