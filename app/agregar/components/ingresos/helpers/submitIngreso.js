// components/ingresos/helpers/submitIngreso.js

import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export async function submitIngreso({
  user,

  tipo,
  subtipo,

  detalle,

  monto,
}) {
  const nombreUsuario =
    user.displayName ||
    user.email?.split("@")[0] ||
    "Usuario";

  await addDoc(
    collection(db, "ingresos"),
    {
      tipo,

      subtipo: subtipo ?? null,

      detalle:
        detalle.trim() || null,

      monto: Number(monto),

      usuario: user.uid,

      usuarioNombre:
        nombreUsuario,

      createdAt: serverTimestamp(),
    },
  );
}