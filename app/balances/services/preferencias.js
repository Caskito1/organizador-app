// balances/services/preferencias.js
// Persistencia de los datos manuales de /balances en `users/{uid}` (5.2, C-10).
// Sin colección ni reglas nuevas: el dueño ya puede escribir su doc
// (firestore.rules:241-246). Recibe `db` como parámetro (app/emulador).

import { doc, getDoc, setDoc } from "firebase/firestore";

import { normalizarMeses } from "../helpers/cadenaSaldos.js";
import { BalancesError } from "../helpers/errores.js";

const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function leerPreferencias({ db, uid } = {}) {
  if (!uid) {
    throw new BalancesError("UID_REQUERIDO", "Falta el usuario del balance.");
  }

  try {
    const snap = await getDoc(doc(db, "users", uid));

    if (!snap.exists()) return { existe: false, meses: {} };

    return { existe: true, meses: normalizarMeses(snap.data()?.balances) };
  } catch (causa) {
    throw new BalancesError(
      "LECTURA_PREFERENCIAS",
      "No pudimos leer tus datos manuales.",
      { causa },
    );
  }
}

export async function guardarMes({
  db,
  uid,
  mes,
  cambios,
  existe,
} = {}) {
  if (!uid) {
    throw new BalancesError("UID_REQUERIDO", "Falta el usuario del balance.");
  }

  if (!existe) {
    throw new BalancesError(
      "PERFIL_FALTANTE",
      "Falta tu perfil de usuario: no se pueden guardar datos manuales.",
    );
  }

  if (typeof mes !== "string" || !MES_RE.test(mes)) {
    throw new BalancesError("MES_INVALIDO", "Mes inválido.");
  }

  try {
    // Merge profundo: escribir un campo del mes no borra los otros y no toca
    // el resto del documento del usuario.
    await setDoc(
      doc(db, "users", uid),
      { balances: { meses: { [mes]: cambios } } },
      { merge: true },
    );
  } catch (causa) {
    throw new BalancesError(
      "ESCRITURA_PREFERENCIAS",
      "No pudimos guardar el dato. Intentá de nuevo.",
      { causa },
    );
  }
}
