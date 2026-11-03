import {
  onSnapshot,
  query,
  collection,
  where,
  orderBy,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export default function subscribeGastos({
  user,
  groups,
  onChange,
  onLoaded,
}) {
  const groupIds = groups.map((g) => g.id);

  const unsubscribers = [];

  const gastosMap = {
    personal: [],
    ...Object.fromEntries(groupIds.map((id) => [id, []])),
  };

  let loadedCount = 0;
  // personal + grupos gastos
  const totalQueries = 1 + groupIds.length;

  function actualizarGastos() {
    loadedCount++;
    const gastos = Object.values(gastosMap).flat();
    onChange({ gastos });
    if (loadedCount >= totalQueries) onLoaded?.();
  }

  // PERSONAL
  const qPersonal = query(
    collection(db, "gastos"),
    where("usuario", "==", user.uid),
    where("tipo", "==", "personal"),
    orderBy("createdAt", "desc"),
  );

  unsubscribers.push(
    onSnapshot(qPersonal, (snap) => {
      gastosMap.personal = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      actualizarGastos();
    }),
  );

  // GRUPOS — gastos
  groupIds.forEach((gid) => {
    // Gastos compartidos
    const qGrupo = query(
      collection(db, "gastos"),
      where("groupId", "==", gid),
      where("tipo", "==", "compartido"),
      orderBy("createdAt", "desc"),
    );

    unsubscribers.push(
      onSnapshot(qGrupo, (snap) => {
        gastosMap[gid] = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        actualizarGastos();
      }),
    );
  });

  return () => unsubscribers.forEach((u) => u());
}