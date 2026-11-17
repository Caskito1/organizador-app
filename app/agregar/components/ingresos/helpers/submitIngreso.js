// components/ingresos/helpers/submitIngreso.js

import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { fechaLocal } from "@/app/gastos/helpers/dateHelpers";
import { monedaDeSubtipo } from "@/app/ingresos/helpers/ingresosMoneda";

export async function submitIngreso({
  user,

  tipo,
  subtipo,

  detalle,

  monto,

  fechaISO,
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

      // 5.0: la moneda NO se elige — se deriva del subtipo (D-2/D-7) y se
      // escribe SIEMPRE, también UYU (P-6). El fallback a UYU del modelo
      // cubre solo los documentos anteriores a 5.0 (D-6).
      moneda: monedaDeSubtipo(subtipo),

      detalle:
        detalle.trim() || null,

      monto: Number(monto),

      usuario: user.uid,

      usuarioNombre:
        nombreUsuario,

      // 4.5-fecha: fecha DEL INGRESO (la elige el usuario). `createdAt`
      // queda como auditoría inmutable.
      fecha: Timestamp.fromDate(
        fechaLocal(fechaISO),
      ),

      createdAt: serverTimestamp(),
    },
  );
}