import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

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

    createdAt: serverTimestamp(),
  });
}