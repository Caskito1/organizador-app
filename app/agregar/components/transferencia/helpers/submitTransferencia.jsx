import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function submitTransferencia({
  user,
  monto,
  concepto,
  detalle,
  selectedGroupId,
  destinatarioUid,
  destinatarioNombre,
}) {
  const nombreUsuario =
    user.displayName ||
    user.email?.split("@")[0] ||
    "Usuario";

  await addDoc(collection(db, "transferencias"), {
    monto: Number(monto),

    concepto, // "alquiler" | "tarjeta" | "otros"

    detalle: concepto === "otros" ? detalle.trim() : null,

    // Quién la envía
    deUid: user.uid,
    deNombre: nombreUsuario,

    // Quién la recibe
    paraUid: destinatarioUid,
    paraNombre: destinatarioNombre,

    groupId: selectedGroupId,

    createdAt: serverTimestamp(),
  });
}