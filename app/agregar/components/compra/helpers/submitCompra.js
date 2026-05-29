import {
  writeBatch,
  doc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export default async function submitCompra({
  carrito,
  user,
  tipo,
  selectedGroupId,
}) {
  const items = Object.values(carrito);

  const nombreUsuario =
    user.displayName ||
    user.email?.split("@")[0] ||
    "Usuario";

  const batch = writeBatch(db);

  items.forEach((it) => {
    const ref = doc(
      collection(db, "gastos"),
    );

    batch.set(ref, {
      monto: Number(it.monto),

      producto: it.esOtros
        ? it.detalle.trim()
        : it.nombre,

      productoId: it.productoId,

      esOtros: it.esOtros,

      cantidad: it.cantidad
        ? Number(it.cantidad)
        : null,

      unidad: it.unidad,

      detalle: it.esOtros
        ? null
        : it.detalle?.trim() || null,

      categoria: it.catId ?? null,

      subcategoria:
        it.subcatId ?? null,

      contexto:
        it.contextoId ?? null,

      tipo,

      usuario: user.uid,

      usuarioNombre:
        nombreUsuario,

      groupId:
        tipo === "compartido"
          ? selectedGroupId
          : null,

      createdAt:
        serverTimestamp(),

      origenCompra: true,
    });
  });

  await batch.commit();
}