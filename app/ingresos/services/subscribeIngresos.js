// ingresos/services/subscribeIngresos.js

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

// 4.5: una sola query. Los ingresos ya no comparten suscripción con
// `transferencias` (flujo retirado). El período se filtra y ordena en cliente
// con `fechaEfectiva` (4.5-fecha): un `where("fecha", …)` excluiría los
// documentos históricos sin `fecha`.
export function subscribeIngresos({
  uid,
  onData,
}) {
  const ingresosQuery = query(
    collection(db, "ingresos"),

    where("usuario", "==", uid),

    orderBy("createdAt", "desc"),
  );

  const unsubIngresos = onSnapshot(
    ingresosQuery,
    (snap) => {
      onData({
        ingresos: snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })),
      });
    },
  );

  return () => {
    unsubIngresos();
  };
}
