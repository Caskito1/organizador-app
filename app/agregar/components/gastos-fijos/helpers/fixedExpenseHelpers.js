import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export async function submitFixedExpense({
  user,
  item,
  monto,
  fecha,
  selectedGroupId,
}) {
  const nombreUsuario =
    user.displayName ||
    user.email?.split("@")[0] ||
    "Usuario";

  const montoNumber =
    Number(monto);

  await addDoc(
    collection(db, "fixed_expenses"),
    {
      nombre: item.nombre,

      expenseId: item.id,

      categoria: item.compartido
        ? "compartido"
        : "personal",

      compartido: item.compartido,

      monto: montoNumber,

      fecha,

      vencimiento: null,

      estado: "pendiente",

      pagado: true,

      balanceado:
        item.compartido
          ? false
          : true,

      saldoPendiente:
        item.compartido
          ? montoNumber / 2
          : 0,

      usuario: user.uid,

      usuarioNombre:
        nombreUsuario,

      groupId:
        item.compartido
          ? selectedGroupId
          : null,

      createdAt:
        serverTimestamp(),
    },
  );
}