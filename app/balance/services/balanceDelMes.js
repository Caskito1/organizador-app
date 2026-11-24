// balance/services/balanceDelMes.js
// ADAPTADOR one-shot del balance consolidado (5.1): trae el historial una sola
// vez con getDocs y delega el cálculo en el núcleo puro. Sin suscripciones y
// sin escrituras (B-4). Recibe `db` como parámetro —la app pasa el de
// @/lib/firebase, el harness el del emulador— y NO importa la config real.
//
// Consultas (plan §5.1.2): igualdad / array-contains, sin `orderBy` y sin
// filtros de fecha/moneda/periodo ⇒ no exigen índices compuestos. Las de grupo
// conservan `tipo` porque las reglas de lectura de `gastos` lo discriminan.

import { collection, getDocs, query, where } from "firebase/firestore";

import { TANDA } from "../../reintegros/services/subscribeReintegros.js";
import {
  BalanceError,
  calcularBalanceDelMes,
  rangoDelMes,
} from "../helpers/balance.js";

function mapDocs(snap) {
  return snap.docs.map((doc) => ({
    id: doc.id,
    // Mismo criterio que subscribeReintegros: resuelve serverTimestamps
    // pendientes (estimate) para no romper los cálculos por mes/fecha.
    ...doc.data({ serverTimestamps: "estimate" }),
  }));
}

// Envuelve la construcción de la consulta y su lectura: cualquier fallo
// (permisos, red, índice) sale tipado con la colección que lo produjo.
async function leer(coleccion, armarConsulta) {
  try {
    return mapDocs(await getDocs(armarConsulta()));
  } catch (causa) {
    throw new BalanceError(
      "LECTURA_FALLIDA",
      `No pudimos leer ${coleccion}.`,
      { coleccion, causa },
    );
  }
}

function idsDeGrupos(groups) {
  return (groups ?? []).map((grupo) => grupo?.id).filter(Boolean);
}

// Lecturas del balance. `groups` lo recibe el adaptador (5.2 los toma de
// GroupContext); NO los descubre solo. No hay lectura de inversiones (B-12).
export async function cargarDatosBalance({ db, uid, groups = [] } = {}) {
  if (!uid) {
    throw new BalanceError("UID_REQUERIDO", "Falta el usuario del balance.");
  }

  const gids = idsDeGrupos(groups);

  const [
    gastosPersonal,
    entriesPersonal,
    ingresos,
    obligaciones,
    gastosPorGrupo,
    entriesPorGrupo,
  ] = await Promise.all([
    leer("gastos", () =>
      query(
        collection(db, "gastos"),
        where("usuario", "==", uid),
        where("tipo", "==", "personal"),
      ),
    ),
    leer("fixed_expense_entries", () =>
      query(
        collection(db, "fixed_expense_entries"),
        where("usuario", "==", uid),
      ),
    ),
    leer("ingresos", () =>
      query(collection(db, "ingresos"), where("usuario", "==", uid)),
    ),
    leer("reintegros", () =>
      query(
        collection(db, "reintegros"),
        where("participantes", "array-contains", uid),
      ),
    ),
    Promise.all(
      gids.map((gid) =>
        leer(`gastos/${gid}`, () =>
          query(
            collection(db, "gastos"),
            where("groupId", "==", gid),
            where("tipo", "==", "compartido"),
          ),
        ),
      ),
    ),
    Promise.all(
      gids.map((gid) =>
        leer(`fixed_expense_entries/${gid}`, () =>
          query(
            collection(db, "fixed_expense_entries"),
            where("groupId", "==", gid),
          ),
        ),
      ),
    ),
  ]);

  // Deduplicar entries por id: un entry propio de un grupo puede volver por la
  // query personal y por la del grupo (subscribeFixedExpenses.js:9-14).
  const entriesMap = new Map();
  for (const lista of [entriesPersonal, ...entriesPorGrupo]) {
    for (const entry of lista) entriesMap.set(entry.id, entry);
  }

  // Entregas en tandas de TANDA (límite del filtro `in` y de las reglas).
  const rids = obligaciones.map((obligacion) => obligacion.id);
  const tandas = [];
  for (let i = 0; i < rids.length; i += TANDA) {
    tandas.push(rids.slice(i, i + TANDA));
  }

  const entregas = (
    await Promise.all(
      tandas.map((tanda) =>
        leer("reintegro_devoluciones", () =>
          query(
            collection(db, "reintegro_devoluciones"),
            where("reintegroId", "in", tanda),
          ),
        ),
      ),
    )
  ).flat();

  return {
    gastos: [...gastosPersonal, ...gastosPorGrupo.flat()],
    fixedEntries: Array.from(entriesMap.values()),
    ingresos,
    obligaciones,
    entregas,
  };
}

// Conveniencia: leer + calcular un mes. `inversiones` viaja tal cual al núcleo
// (el adaptador no la consulta). El mes se valida ANTES de leer.
export default async function balanceDelMes({
  db,
  uid,
  mes,
  groups = [],
  ahora,
  inversiones = 0,
} = {}) {
  rangoDelMes(mes);

  const datos = await cargarDatosBalance({ db, uid, groups });

  return calcularBalanceDelMes({ mes, uid, datos, ahora, inversiones });
}
