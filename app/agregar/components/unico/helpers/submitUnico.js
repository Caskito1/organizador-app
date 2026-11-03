import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { fechaLocal } from "@/app/gastos/helpers/dateHelpers";

export async function submitUnico({
  user,
  monto,
  producto,
  esOtros,
  detalle,
  cantidad,
  unidadActual,
  catId,
  subcatId,
  contexto,
  tipo,
  selectedGroupId,
  fechaISO,
}) {
  const nombreUsuario =
    user.displayName ||
    user.email?.split("@")[0] ||
    "Usuario";

  await addDoc(collection(db, "gastos"), {
    monto: Number(monto),

    producto: esOtros
      ? detalle.trim()
      : producto?.nombre,

    productoId: esOtros
      ? "__otros__"
      : producto?.id ?? null,

    esOtros,

    cantidad: cantidad
      ? Number(cantidad)
      : null,

    unidad: unidadActual,

    detalle: esOtros
      ? null
      : detalle.trim() || null,

    categoria: catId ?? null,

    subcategoria: subcatId ?? null,

    contexto: contexto?.id ?? null,

    tipo,

    usuario: user.uid,

    usuarioNombre: nombreUsuario,

    groupId:
      tipo === "compartido"
        ? selectedGroupId
        : null,

    // 4.5-fecha: fecha DEL GASTO (la elige el usuario). `createdAt` queda
    // como auditoría inmutable.
    fecha: Timestamp.fromDate(fechaLocal(fechaISO)),

    createdAt: serverTimestamp(),
  });
}