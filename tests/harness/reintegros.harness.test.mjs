// tests/harness/reintegros.harness.test.mjs
// Harness del módulo Reintegros (4.1) contra el emulador demo-finanzas.
// Prueba los helpers REALES (submitReintegro/submitDevolucion y la
// edición de monto de 4.3b: editarEntrega/editarObligacion) y la
// suscripción (subscribeReintegros) + funciones puras del modelo.
//
// Ningún archivo importado por este harness carga la config real de
// Firebase: los helpers reciben `db` como parámetro (ajuste 1, 4.1).
//
// Casos de §14.1 (PROPUESTA-ETAPA-3) + ajustes aprobados del plan 4.1:
//   1  (H1)   alta ambos sentidos, participantes + evento
//   2  (H2)   devolución parcial miembro
//   2b (H2b)  devolución parcial externa
//   3  (H3)   devolución completa → liquidado
//   3b (H3b)  devolución sobre miembro sin confirmación previa (procede)
//   4  (H4)   sobrepago rechazado SALDO_INSUFICIENTE
//   5a (H5a)  concurrencia: suma > saldo → una gana (invariante sin sobregiro)
//   5b (H5b)  suma ≤ saldo → dos secuenciales ambas ganan (ver nota emulador)
//   6  —      sin red: omitido (el emulador no simula conectividad); ver EVIDENCIA §10
//   7  (H7)   atribución: pagador ≠ registrador
//   8  (H8)   reconciliación D-7 + negativo H-a (forge de devuelto)
//   9  (H9)   no participante → error de permisos, sin escritura
//   10 (H10)  estado derivado: sin campo `estado` almacenado
//   11 (H11)  monto NO entero → MONTO_INVALIDO (cliente) y `is int` (reglas)
//   12 (H12)  validaciones de entrada: NO_ENCONTRADA, campos requeridos
//   13 (H13)  I-8 + espejo 4.3c: movimientoInicial propio sí; la contraparte
//             nunca bookkea una salida propia ajena, pero sí la entrada espejo
//   14 (H14)  contraparteUid externa '': null (ajuste 6, 4.2) + tipo inválido
//   +  (HS0)  suscripción con 0 obligaciones (sin D1 con lista vacía)
//   +  (HS1)  alta nueva → re-emisión de la suscripción
//   +  (HS2)  batching TANDA: 12 obls → 12 entregas traídas
//   +  (HS3)  cleanup: unsubscribe sin errores
//   +  (HS4)  cleanup tras emitir R1' con datos: sin errores ni emisiones
//   +  (H15)  editar entrega (baja): delta exacto, evento edicion/entrega
//   +  (H15b) contraparte edita entrega (ambas partes)
//   +  (H16)  subir pago hasta agotar saldo → liquidado (migra a Saldados)
//   +  (H16b) subir de más → SALDO_INSUFICIENTE, sin escritura
//   +  (H17)  guardas cliente: LIQUIDADA/CONDONADA/ELIMINADA (sin escritura)
//   +  (H18)  editar obligación (devuelto == 0): positiva + evento
//   +  (H18b) no registrador → NO_REGISTRADOR
//   +  (H19)  devuelto > 0 → MONTO_BLOQUEADO
//   +  (H20)  monto sin cambios → MONTO_SIN_CAMBIOS, sin evento
//   +  (H21)  concurrencia edición + pago: exactamente uno gana, sin sobregiro
// H15–H21: edición de monto (4.3b, 21/10/2026). NOTA: en H17, LIQUIDADA es
// ÚNICAMENTE guardia de cliente — las reglas no la bloquean (ver
// EVIDENCIA-4.3.md).
//   +  (H22)  espejo por_cobrar + dinero: contraparte ve entrada en la alta
//   +  (H23)  espejo por_cobrar + ítem: contraparte no bookkea nada
//   +  (H24)  espejo por_devolver con tick: contraparte ve salida en la alta
//   +  (H25)  espejo por_devolver sin tick (ítem): contraparte ve salida (siempre)
//   +  (H26)  externa / no participante: sin espejo
//   +  (H27)  retrocompat: por_cobrar vieja sin movimientoInicialTipo → dinero
//   +  (H28)  movimientoInicialTipo inválido → espejo como dinero, sin chip
//   +  (H29)  espejo con monto editado vía editarObligacion
//   +  (H30)  tipoDineroDe (chip Dinero/Ítem): derivación por sentidos
//   +  (H31)  alta con movimientoInicialTipo: dinero/item, ausente y rechazos
// H22–H31: espejo, chip y alta (4.3c, 21/10/2026).

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

import {
  subscribeReintegros,
  TANDA,
} from "../../app/reintegros/services/subscribeReintegros.js";
import { submitReintegro } from "../../app/agregar/components/reintegros/helpers/submitReintegro.js";
import {
  submitDevolucion,
  ReintegroError,
} from "../../app/agregar/components/reintegros/helpers/submitDevolucion.js";
import { editarEntrega } from "../../app/agregar/components/reintegros/helpers/editarEntrega.js";
import { editarObligacion } from "../../app/agregar/components/reintegros/helpers/editarObligacion.js";
import {
  sentidoDelViewer,
  saldoDe,
  estadoDe,
  assertDevueltoConsistente,
  sumaEntregasNoEliminadas,
  entradasDelMes,
  salidasDelMes,
  tipoDineroDe,
} from "../../app/reintegros/helpers/modelo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rulesSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "firestore.rules"),
  "utf8",
);

const A = "uid_alice";
const B = "uid_bob";
const C = "uid_carol";
// Uids dedicados a los tests de suscripción (aislamiento de datos).
const SUB1 = "uid_sub_1";
const SUB2 = "uid_sub_2";
const SUB3 = "uid_sub_3";
const SUB4 = "uid_sub_4";
const SUB5 = "uid_sub_5";

let testEnv;

function dbAs(uid) {
  return uid === null
    ? testEnv.unauthenticatedContext().firestore()
    : testEnv.authenticatedContext(uid).firestore();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function seedObl(rid, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "reintegros", rid), data);
  });
}

async function seedEntrega(did, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "reintegro_devoluciones", did), data);
  });
}

function baseObl(over = {}) {
  return {
    registradoPor: A,
    registradoPorNombre: "Alice",
    contraparteUid: B,
    contraparteNombre: "Bob",
    participantes: [A, B],
    sentido: "por_cobrar",
    monto: 1000,
    devuelto: 0,
    movimientoInicial: "ninguno",
    concepto: "Alquiler octubre",
    gastoVinculadoId: null,
    createdAt: Timestamp.now(),
    ...over,
  };
}

function externalObl(over = {}) {
  return {
    registradoPor: A,
    registradoPorNombre: "Alice",
    contraparteUid: null,
    contraparteNombre: "Proveedor",
    participantes: [A],
    sentido: "por_cobrar",
    monto: 500,
    devuelto: 0,
    movimientoInicial: "ninguno",
    concepto: "Reembolso proveedor",
    gastoVinculadoId: null,
    createdAt: Timestamp.now(),
    ...over,
  };
}

async function readObl(rid, asUid = A) {
  const snap = await getDoc(doc(dbAs(asUid), "reintegros", rid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function readEntregas(rid, asUid = A) {
  const q = query(
    collection(dbAs(asUid), "reintegro_devoluciones"),
    where("reintegroId", "==", rid),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function readEventos(rid, asUid = A) {
  const snap = await getDocs(
    collection(dbAs(asUid), "reintegros", rid, "eventos"),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── Colector de emisiones de subscribeReintegros ─────────────────────────
function createCollector(db, uid) {
  const emissions = [];
  let lastError = null;
  const unsub = subscribeReintegros({
    db,
    uid,
    onData: (data) => emissions.push(data),
    onError: (e) => {
      lastError = e;
    },
  });
  return {
    emissions,
    get error() {
      return lastError;
    },
    async waitFor(pred, timeoutMs = 8000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const last = emissions[emissions.length - 1];
        if (last && pred(last)) return last;
        if (lastError) throw lastError;
        await sleep(30);
      }
      throw new Error(
        `waitFor timeout tras ${emissions.length} emisiones` +
          (lastError ? `; error: ${lastError.message}` : ""),
      );
    },
    unsub: () => unsub?.(),
  };
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-finanzas",
    firestore: { rules: rulesSrc },
  });
});

after(async () => {
  await testEnv.cleanup();
});

// ═══ Caso 1 — submitReintegro: ambos sentidos, participantes + evento ═══

test("H1 — submitReintegro: alta miembro y externa, shape exacto, evento creacion/obligacion", async () => {
  const dbA = dbAs(A);

  // 1a: miembro (por_cobrar) — sin confirmadaPor (17/10/2026)
  const { rid: ridMember } = await submitReintegro({
    db: dbA,
    uid: A,
    uidNombre: "Alice",
    sentido: "por_cobrar",
    monto: 1000,
    contraparteUid: B,
    contraparteNombre: "Bob",
    groupId: null,
    concepto: "Mueble 50/50",
    detalle: "parte de Bob",
    movimientoInicial: "salida",
  });
  const oblM = await readObl(ridMember, A);
  assert.equal(oblM.registradoPor, A);
  assert.deepEqual(oblM.participantes, [A, B]);
  assert.equal(oblM.contraparteUid, B);
  assert.equal(oblM.sentido, "por_cobrar");
  assert.equal(oblM.monto, 1000);
  assert.equal(oblM.devuelto, 0);
  assert.equal(oblM.gastoVinculadoId, null);
  assert.equal(oblM.movimientoInicial, "salida");
  assert.equal(oblM.concepto, "Mueble 50/50");
  assert.ok(oblM.createdAt instanceof Timestamp, "createdAt debe ser Timestamp");
  assert.ok(!("confirmadaPor" in oblM), "miembro: sin confirmadaPor");
  assert.ok(!("condonacion" in oblM), "sin condonacion al nacer");
  assert.ok(!("eliminacion" in oblM), "sin eliminacion al nacer");
  // Evento creacion/obligacion en la misma transacción
  const evsM = await readEventos(ridMember, A);
  assert.equal(evsM.length, 1);
  assert.equal(evsM[0].tipo, "creacion");
  assert.equal(evsM[0].entidad, "obligacion");
  assert.equal(evsM[0].registradoPor, A);

  // 1b: externa (por_devolver) — confirmadaPor AUSENTE
  const { rid: ridExt } = await submitReintegro({
    db: dbA,
    uid: A,
    uidNombre: "Alice",
    sentido: "por_devolver",
    monto: 500,
    contraparteUid: null,
    contraparteNombre: "Proveedor",
    groupId: null,
    concepto: "Reembolso",
    detalle: null,
    movimientoInicial: "ninguno",
  });
  const oblE = await readObl(ridExt, A);
  assert.deepEqual(oblE.participantes, [A]);
  assert.equal(oblE.contraparteUid, null);
  assert.equal(oblE.devuelto, 0);
  assert.ok(!("confirmadaPor" in oblE), "externa: confirmadaPor AUSENTE");
  assert.equal(oblE.gastoVinculadoId, null);
  const evsE = await readEventos(ridExt, A);
  assert.equal(evsE.length, 1);
  assert.equal(evsE[0].tipo, "creacion");
  assert.equal(evsE[0].entidad, "obligacion");
});

// ═══ Caso 2 — devolución parcial miembro ═══

test("H2 — devolución parcial sobre miembro: devuelto baja, saldo > 0, estado parcial, D-7 ok", async () => {
  const rid = "h2_conf";
  await seedObl(rid, baseObl({ monto: 1000, devuelto: 0 }));
  const dbA = dbAs(A);

  await submitDevolucion({
    db: dbA,
    uid: A,
    uidNombre: "Alice",
    rid,
    monto: 300,
    realizadoPorUid: A,
    realizadoPorNombre: "Alice",
    fechaPago: Timestamp.now(),
  });

  const obl = await readObl(rid, A);
  assert.equal(obl.devuelto, 300);
  assert.equal(saldoDe(obl), 700);
  assert.equal(estadoDe(obl), "parcial");

  const entregas = await readEntregas(rid, A);
  assert.equal(entregas.length, 1);
  assert.equal(entregas[0].monto, 300);
  assert.equal(entregas[0].reintegroId, rid);
  // Evento creacion/entrega
  const evs = await readEventos(rid, A);
  const entregaEv = evs.find((e) => e.entidad === "entrega");
  assert.ok(entregaEv, "evento creacion/entrega presente");
  assert.equal(entregaEv.tipo, "creacion");
  // D-7 consistente
  assert.ok(assertDevueltoConsistente(obl, entregas));
});

// ═══ Caso 2b — devolución parcial externa ═══

test("H2b — devolución parcial sobre externa: devuelto baja, estado parcial", async () => {
  const rid = "h2b_ext";
  await seedObl(rid, externalObl({ monto: 500, devuelto: 0 }));

  await submitDevolucion({
    db: dbAs(A),
    uid: A,
    uidNombre: "Alice",
    rid,
    monto: 200,
    realizadoPorUid: null,
    realizadoPorNombre: "Proveedor",
    fechaPago: Timestamp.now(),
  });

  const obl = await readObl(rid, A);
  assert.equal(obl.devuelto, 200);
  assert.equal(saldoDe(obl), 300);
  assert.equal(estadoDe(obl), "parcial");
  const entregas = await readEntregas(rid, A);
  assert.ok(assertDevueltoConsistente(obl, entregas));
});

// ═══ Caso 3 — devolución completa → liquidado ═══

test("H3 — devolución completa: saldo 0, estado liquidado, D-7 ok", async () => {
  const rid = "h3_full";
  await seedObl(rid, baseObl({ monto: 1000, devuelto: 0 }));

  await submitDevolucion({
    db: dbAs(A),
    uid: A,
    uidNombre: "Alice",
    rid,
    monto: 1000,
    realizadoPorUid: B,
    realizadoPorNombre: "Bob",
    fechaPago: Timestamp.now(),
  });

  const obl = await readObl(rid, A);
  assert.equal(obl.devuelto, 1000);
  assert.equal(saldoDe(obl), 0);
  assert.equal(estadoDe(obl), "liquidado");
  const entregas = await readEntregas(rid, A);
  assert.ok(assertDevueltoConsistente(obl, entregas));
});

// ═══ Caso 3b — devolución sobre miembro SIN confirmación previa ═══

test("H3b — miembro sin confirmacion previa: la devolución procede (SIN_CONFIRMAR eliminado)", async () => {
  const rid = "h3b_sinconfirmar";
  // Miembro sin estado de confirmación (esquema tras el lote 17/10/2026)
  await seedObl(rid, baseObl({ monto: 1000, devuelto: 0 }));

  await submitDevolucion({
    db: dbAs(A),
    uid: A,
    uidNombre: "Alice",
    rid,
    monto: 300,
    realizadoPorUid: A,
    realizadoPorNombre: "Alice",
    fechaPago: Timestamp.now(),
  });

  const obl = await readObl(rid, A);
  assert.equal(obl.devuelto, 300, "devuelto sube exactamente el monto");
  const entregas = await readEntregas(rid, A);
  assert.equal(entregas.length, 1, "entrega creada");
  assert.ok(assertDevueltoConsistente(obl, entregas));
});

// ═══ Caso 4 — sobrepago rechazado SALDO_INSUFICIENTE ═══

test("H4 — sobrepago: lanza SALDO_INSUFICIENTE, devuelto intacto", async () => {
  const rid = "h4_sobrepago";
  await seedObl(rid, baseObl({ monto: 1000, devuelto: 800 }));

  await assert.rejects(
    () =>
      submitDevolucion({
        db: dbAs(A),
        uid: A,
        uidNombre: "Alice",
        rid,
        monto: 300,
        realizadoPorUid: A,
        realizadoPorNombre: "Alice",
        fechaPago: Timestamp.now(),
      }),
    (err) => {
      assert.ok(err instanceof ReintegroError);
      assert.equal(err.code, "SALDO_INSUFICIENTE");
      return true;
    },
  );

  const obl = await readObl(rid, A);
  assert.equal(obl.devuelto, 800, "devuelto intacto tras rechazo");
});

// ═══ Caso 5a — concurrencia: suma > saldo → exactamente una gana ═══
//
// Nota (emulador vs producción): en el emulador, las reglas evalúan el
// update contra el estado YA GANADOR — el perdedor recibe permission-denied
// (no retry como `aborted`). En producción el SDK reintentaría y el check
// de cliente tiraría SALDO_INSUFICIENTE. El INVARIANTE es el mismo:
// exactamente una gana, sin sobregiro, D-7 consistente.

test("H5a — concurrencia suma > saldo: exactamente una gana, sin sobregiro, D-7 ok", async () => {
  const rid = "h5a_conc";
  await seedObl(rid, baseObl({ monto: 1000, devuelto: 0 }));
  const dbA = dbAs(A);

  const mk = () =>
    submitDevolucion({
      db: dbA,
      uid: A,
      uidNombre: "Alice",
      rid,
      monto: 600,
      realizadoPorUid: A,
      realizadoPorNombre: "Alice",
      fechaPago: Timestamp.now(),
    });

  const results = await Promise.allSettled([mk(), mk()]);
  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");
  assert.equal(fulfilled.length, 1, "exactamente una debe ganar");
  assert.equal(rejected.length, 1, "exactamente una debe fallar");
  // El error del perdedor varía según el motor: SALDO_INSUFICIENTE (check
  // de cliente en retry) o permission-denied (reglas contra estado ganador).
  const code = rejected[0].reason?.code;
  assert.ok(
    code === "SALDO_INSUFICIENTE" || code === "permission-denied",
    `error del perdedor inesperado: ${code}`,
  );

  const obl = await readObl(rid, A);
  assert.equal(obl.devuelto, 600, "devuelto == monto de la entrega ganadora");
  const entregas = await readEntregas(rid, A);
  assert.equal(entregas.length, 1);
  assert.ok(assertDevueltoConsistente(obl, entregas));
});

// ═══ Caso 5b — suma ≤ saldo: ambas ganan (secuencial) ═══
//
// Secuencial (no simultáneo): en el emulador, dos transacciones del mismo
// cliente lanzadas en paralelo hacen que el perdedor reciba permission-denied
// (las reglas evalúan contra el estado ganador, sin retry). En producción el
// retry permitiría que ambas ganaran. Aquí verificamos que DOS devoluciones
// legítimas (cada una ≤ saldo) pueden coexistir cuando no se pisan: el saldo
// las admite ambas y D-7 queda consistente.

test("H5b — suma ≤ saldo: dos devoluciones secuenciales ambas ganan, devuelto == 800, D-7 ok", async () => {
  const rid = "h5b_conc";
  await seedObl(rid, baseObl({ monto: 1000, devuelto: 0 }));
  const dbA = dbAs(A);

  const mk = () =>
    submitDevolucion({
      db: dbA,
      uid: A,
      uidNombre: "Alice",
      rid,
      monto: 400,
      realizadoPorUid: A,
      realizadoPorNombre: "Alice",
      fechaPago: Timestamp.now(),
    });

  await mk();
  await mk();

  const obl = await readObl(rid, A);
  assert.equal(obl.devuelto, 800);
  const entregas = await readEntregas(rid, A);
  assert.equal(entregas.length, 2);
  assert.ok(assertDevueltoConsistente(obl, entregas));
});

// ═══ Caso 7 — atribución: pagador ≠ registrador ═══

test("H7 — atribución: registradoPor=A, realizadoPorUid=B (I-6)", async () => {
  const rid = "h7_attr";
  await seedObl(rid, baseObl({ monto: 1000, devuelto: 0 }));

  await submitDevolucion({
    db: dbAs(A),
    uid: A,
    uidNombre: "Alice",
    rid,
    monto: 500,
    realizadoPorUid: B,
    realizadoPorNombre: "Bob",
    fechaPago: Timestamp.now(),
  });

  const entregas = await readEntregas(rid, A);
  assert.equal(entregas.length, 1);
  assert.equal(entregas[0].registradoPor, A, "registrador es A");
  assert.equal(entregas[0].realizadoPorUid, B, "pagador es B");
  assert.equal(entregas[0].realizadoPorNombre, "Bob");
});

// ═══ Caso 8 — reconciliación D-7: positivo + negativo H-a ═══

test("H8 — D-7: consistente tras secuencia; negativo H-a detecta forge de devuelto", async () => {
  const rid = "h8_d7";
  await seedObl(rid, baseObl({ monto: 1000, devuelto: 0 }));
  const dbA = dbAs(A);

  // Secuencia: dos devoluciones
  await submitDevolucion({
    db: dbA, uid: A, uidNombre: "Alice", rid,
    monto: 300, realizadoPorUid: A, realizadoPorNombre: "Alice",
    fechaPago: Timestamp.now(),
  });
  await submitDevolucion({
    db: dbA, uid: A, uidNombre: "Alice", rid,
    monto: 200, realizadoPorUid: A, realizadoPorNombre: "Alice",
    fechaPago: Timestamp.now(),
  });

  let obl = await readObl(rid, A);
  let entregas = await readEntregas(rid, A);
  assert.equal(obl.devuelto, 500);
  assert.equal(sumaEntregasNoEliminadas(entregas), 500);
  assert.ok(assertDevueltoConsistente(obl, entregas), "positivo: consistente");

  // NEGATIVO (H-a): participante normal forja devuelto SIN entrega acompañante.
  // Las reglas lo permiten (update rama (a) no exige acople bidireccional);
  // D-7 lo detecta post-hoc. Es la limitación aceptada H-a.
  const ridForge = "h8_forge";
  await seedObl(ridForge, baseObl({ monto: 1000, devuelto: 0 }));
  await updateDoc(doc(dbA, "reintegros", ridForge), { devuelto: 500 });
  const oblForge = await readObl(ridForge, A);
  const entregasForge = await readEntregas(ridForge, A);
  assert.equal(oblForge.devuelto, 500);
  assert.equal(entregasForge.length, 0, "sin entrega acompañante (H-a)");
  assert.ok(
    !assertDevueltoConsistente(oblForge, entregasForge),
    "D-7 detecta la divergencia (H-a documentado)",
  );
});

// ═══ Caso 9 — no participante: error de permisos, sin escritura ═══

test("H9 — no participante (C): submitDevolucion falla con permisos, sin escritura", async () => {
  const rid = "h9_ajeno";
  await seedObl(rid, baseObl({ monto: 1000, devuelto: 0 }));

  await assert.rejects(() =>
    submitDevolucion({
      db: dbAs(C),
      uid: C,
      uidNombre: "Carol",
      rid,
      monto: 100,
      realizadoPorUid: C,
      realizadoPorNombre: "Carol",
      fechaPago: Timestamp.now(),
    }),
  );

  // Sin escritura: devuelto intacto, sin entregas
  const obl = await readObl(rid, A);
  assert.equal(obl.devuelto, 0);
  const entregas = await readEntregas(rid, A);
  assert.equal(entregas.length, 0);
});

// ═══ Caso 10 — estado derivado: sin campo `estado` almacenado ═══

test("H10 — estado 100% derivado: ningún doc almacena campo `estado`", async () => {
  const rid = "h10_estado";
  await seedObl(rid, baseObl({ monto: 1000, devuelto: 0 }));
  await submitDevolucion({
    db: dbAs(A), uid: A, uidNombre: "Alice", rid,
    monto: 300, realizadoPorUid: A, realizadoPorNombre: "Alice",
    fechaPago: Timestamp.now(),
  });

  const obl = await readObl(rid, A);
  assert.ok(!("estado" in obl), "obl sin campo estado");
  const entregas = await readEntregas(rid, A);
  for (const e of entregas) {
    assert.ok(!("estado" in e), "entrega sin campo estado");
  }
  // Y el estado se calcula correctamente
  assert.equal(estadoDe(obl), "parcial");
});

// ═══ Caso 11 — montos: SIEMPRE enteros en pesos ═══
//
// Decisión del usuario (16/10/2026): montos enteros en pesos, sin centavos.
// Cliente (helpers) valida Number.isInteger(monto) → ReintegroError
// MONTO_INVALIDO. Reglas: `is int` en create de reintegros, create de
// reintegro_devoluciones, rama (c) de update (edit monto de obl) y rama (ii)
// de update (edit monto de entrega). Si se admiten centavos en el futuro,
// migrar a unidad menor (centavos enteros).

test("H11 — monto decimal: rechazado en alta y entrega (cliente), y en edit monto por reglas", async () => {
  const dbA = dbAs(A);

  // (a) Alta con monto 0.5: MONTO_INVALIDO (cliente), sin escritura
  await assert.rejects(
    () =>
      submitReintegro({
        db: dbA,
        uid: A,
        uidNombre: "Alice",
        sentido: "por_cobrar",
        monto: 0.5,
        contraparteUid: null,
        contraparteNombre: "Proveedor",
        groupId: null,
        concepto: "Café",
        detalle: null,
        movimientoInicial: "ninguno",
      }),
    (err) => {
      assert.ok(err instanceof ReintegroError);
      assert.equal(err.code, "MONTO_INVALIDO");
      return true;
    },
  );

  // (b) Entrega con monto 0.5 sobre obl entera: MONTO_INVALIDO (cliente)
  const rid = "h11_dec";
  await seedObl(rid, baseObl({ monto: 1000, devuelto: 0 }));
  await assert.rejects(
    () =>
      submitDevolucion({
        db: dbA, uid: A, uidNombre: "Alice", rid,
        monto: 0.5, realizadoPorUid: A, realizadoPorNombre: "Alice",
        fechaPago: Timestamp.now(),
      }),
    (err) => {
      assert.ok(err instanceof ReintegroError);
      assert.equal(err.code, "MONTO_INVALIDO");
      return true;
    },
  );
  let obl = await readObl(rid, A);
  assert.equal(obl.devuelto, 0, "sin escritura tras rechazo de cliente");

  // (c) Edit monto de obl a 0.5 vía batch directo (sin check de cliente):
  //     las reglas la rama (c) rechazan (is int).
  const b1 = writeBatch(dbA);
  b1.update(doc(dbA, "reintegros", rid), { monto: 0.5 });
  await assertFails(b1.commit());

  // (d) Edit monto de entrega a 0.5 vía batch directo: reglas rama (ii)
  //     rechazan (is int). Primero una entrega entera válida.
  await submitDevolucion({
    db: dbA, uid: A, uidNombre: "Alice", rid,
    monto: 100, realizadoPorUid: A, realizadoPorNombre: "Alice",
    fechaPago: Timestamp.now(),
  });
  const entregas = await readEntregas(rid, A);
  assert.equal(entregas.length, 1);
  const b2 = writeBatch(dbA);
  b2.update(doc(dbA, "reintegro_devoluciones", entregas[0].id), { monto: 0.5 });
  await assertFails(b2.commit());
  const entregas2 = await readEntregas(rid, A);
  assert.equal(entregas2[0].monto, 100, "monto de entrega intacto");

  // (e) Flujo entero completo: monto 300, pagos 100 + 200 → liquidado.
  const { rid: ridInt } = await submitReintegro({
    db: dbA, uid: A, uidNombre: "Alice", sentido: "por_cobrar",
    monto: 300, contraparteUid: null, contraparteNombre: "Proveedor",
    groupId: null, concepto: "Entero", detalle: null, movimientoInicial: "ninguno",
  });
  await submitDevolucion({
    db: dbA, uid: A, uidNombre: "Alice", rid: ridInt,
    monto: 100, realizadoPorUid: A, realizadoPorNombre: "Alice",
    fechaPago: Timestamp.now(),
  });
  await submitDevolucion({
    db: dbA, uid: A, uidNombre: "Alice", rid: ridInt,
    monto: 200, realizadoPorUid: A, realizadoPorNombre: "Alice",
    fechaPago: Timestamp.now(),
  });
  const oblInt = await readObl(ridInt, A);
  assert.equal(oblInt.devuelto, 300);
  assert.equal(estadoDe(oblInt), "liquidado");
  console.log(
    "H11 INFO: montos enteros en pesos — 300 = 100 + 200 liquidado sin error de precisión.",
  );
});

// ═══ Caso 12 — validaciones de entrada (NO_ENCONTRADA + campos) ═══

test("H12 — submitDevolucion: NO_ENCONTRADA / permisos para rid inexistente; campos requeridos validados", async () => {
  const dbA = dbAs(A);

  // (a) rid inexistente: bajo reglas, la Lectura del doc se DENIEGA primero
  //     (`get: uid() in resource.data.participantes` falla con resource null
  //     → permission-denied, sin leak de existencia). El guard NO_ENCONTRADA
  //     del helper es defense-in-depth: dispara cuando la lectura SÍ pasa pero
  //     el doc no existe (p. ej. db sin reglas o reglas que permitan el get).
  //     Verificamos que RECHAZA y que el error es NO_ENCONTRADA (si la
  //     lectura pasara) o permission-denied (reglas).
  await assert.rejects(
    () =>
      submitDevolucion({
        db: dbA, uid: A, uidNombre: "Alice", rid: "no_existe_xyz",
        monto: 100, realizadoPorUid: A, realizadoPorNombre: "Alice",
        fechaPago: Timestamp.now(),
      }),
    (err) => {
      const ok =
        (err instanceof ReintegroError && err.code === "NO_ENCONTRADA") ||
        err?.code === "permission-denied";
      assert.ok(
        ok,
        `esperaba NO_ENCONTRADA o permission-denied, obtuve ${err?.code}`,
      );
      return true;
    },
  );

  // (b) realizadoPorNombre vacío → VALIDACION
  const rid = "h12_val";
  await seedObl(rid, baseObl({ monto: 1000, devuelto: 0 }));
  await assert.rejects(
    () =>
      submitDevolucion({
        db: dbA, uid: A, uidNombre: "Alice", rid,
        monto: 100, realizadoPorUid: A, realizadoPorNombre: "",
        fechaPago: Timestamp.now(),
      }),
    (err) => {
      assert.ok(err instanceof ReintegroError);
      assert.equal(err.code, "VALIDACION");
      return true;
    },
  );

  // (c) fechaPago ausente → VALIDACION
  await assert.rejects(
    () =>
      submitDevolucion({
        db: dbA, uid: A, uidNombre: "Alice", rid,
        monto: 100, realizadoPorUid: A, realizadoPorNombre: "Alice",
      }),
    (err) => {
      assert.ok(err instanceof ReintegroError);
      assert.equal(err.code, "VALIDACION");
      return true;
    },
  );

  // (d) submitReintegro: sentido inválido → VALIDACION
  await assert.rejects(
    () =>
      submitReintegro({
        db: dbA, uid: A, uidNombre: "Alice", sentido: "inventado",
        monto: 100, contraparteUid: null, contraparteNombre: "X",
        groupId: null, concepto: "C", detalle: null, movimientoInicial: "ninguno",
      }),
    (err) => {
      assert.ok(err instanceof ReintegroError);
      assert.equal(err.code, "VALIDACION");
      return true;
    },
  );

  // (e) submitReintegro: movimientoInicial inválido → VALIDACION
  await assert.rejects(
    () =>
      submitReintegro({
        db: dbA, uid: A, uidNombre: "Alice", sentido: "por_cobrar",
        monto: 100, contraparteUid: null, contraparteNombre: "X",
        groupId: null, concepto: "C", detalle: null, movimientoInicial: "otra",
      }),
    (err) => {
      assert.ok(err instanceof ReintegroError);
      assert.equal(err.code, "VALIDACION");
      return true;
    },
  );

  // (f) submitReintegro: uidNombre vacío → VALIDACION
  await assert.rejects(
    () =>
      submitReintegro({
        db: dbA, uid: A, uidNombre: "", sentido: "por_cobrar",
        monto: 100, contraparteUid: null, contraparteNombre: "X",
        groupId: null, concepto: "C", detalle: null, movimientoInicial: "ninguno",
      }),
    (err) => {
      assert.ok(err instanceof ReintegroError);
      assert.equal(err.code, "VALIDACION");
      return true;
    },
  );

  // Sin escritura residual
  const obl = await readObl(rid, A);
  assert.equal(obl.devuelto, 0);
  assert.equal((await readEntregas(rid, A)).length, 0);
});

// ═══ Caso 13 — I-8 + espejo 4.3c: sin duplicación ═══
//
// §6.2 (actualizado 4.3c): entradas/salidas suman el movimientoInicial SOLO
// de las obligaciones creadas por el usuario (registradoPor === uid). La
// contraparte NUNCA bookkea una salida propia ajena (I-8: atribución al
// registrador — no duplica), pero sí bookkea el espejo: en este escena (doc
// por_cobrar sin movimientoInicialTipo = viejo = dinero), A ve su ENTRADA
// espejo en el mes de la alta.

test("H13 — I-8: movimientoInicial propio sí; contraparte bookkea la entrada espejo, nunca salida propia", () => {
  const start = new Date(2026, 9, 1); // octubre 2026
  const nextStart = new Date(2026, 10, 1); // noviembre 2026
  const createdAt = Timestamp.fromDate(new Date(2026, 9, 15));

  // Obl CREADA POR B (registradoPor=B), sentido por_cobrar, movimientoInicial
  // "salida" (B ya registró la salida en SU libro). A es la contraparte.
  // Sin movimientoInicialTipo (doc viejo) → el espejo la trata como dinero.
  const oblDeB = {
    id: "i8_de_b",
    registradoPor: B,
    contraparteUid: A,
    participantes: [A, B],
    sentido: "por_cobrar",
    monto: 1000,
    devuelto: 0,
    movimientoInicial: "salida",
    createdAt,
  };
  const obligaciones = [oblDeB];
  const entregas = [];

  // Vista de B (registrador): la salida SÍ cuenta (1000).
  assert.equal(
    salidasDelMes({ obligaciones, entregas, uid: B, start, nextStart }),
    1000,
    "registrador B cuenta su propio movimientoInicial salida",
  );
  assert.equal(
    entradasDelMes({ obligaciones, entregas, uid: B, start, nextStart }),
    0,
    "registrador B: sin entradas (no hay entregas recibidas)",
  );

  // Vista de A (contraparte miembro): nunca una salida propia del doc ajeno
  // (I-8: no duplica), pero sí la entrada espejo 4.3c (por_cobrar + dinero).
  assert.equal(
    salidasDelMes({ obligaciones, entregas, uid: A, start, nextStart }),
    0,
    "contraparte A NO bookkea salida propia del doc ajeno (I-8, no duplica)",
  );
  assert.equal(
    entradasDelMes({ obligaciones, entregas, uid: A, start, nextStart }),
    1000,
    "contraparte A bookkea la entrada espejo en el mes de la alta (4.3c)",
  );
});

// ═══ Caso 14 — contraparteUid externa: '', null y undefined → null ═══
//
// Ajuste 6 (4.2): la UI puede enviar "" (estado vacío del selector) o
// undefined; el helper debe normalizarlos a null (shape de reglas para
// externa: participantes solo con el registrador). ""
// JAMÁS se persiste. Un tipo no-string es error de validación y no escribe.

test("H14 — contraparteUid externa: '', null y undefined → null en Firestore", async () => {
  const casos = [
    { label: "string vacío", rid: "h14_ext_vacio", contraparteUid: "" },
    { label: "null", rid: "h14_ext_null", contraparteUid: null },
    {
      label: "undefined",
      rid: "h14_ext_undefined",
      contraparteUid: undefined,
    },
  ];

  for (const { label, rid, contraparteUid } of casos) {
    await submitReintegro({
      db: dbAs(A),
      uid: A,
      uidNombre: "Alice",
      sentido: "por_devolver",
      monto: 250,
      contraparteUid,
      contraparteNombre: "Proveedor",
      groupId: null,
      concepto: `Alta externa (${label})`,
      detalle: null,
      movimientoInicial: "ninguno",
      rid,
    });

    const obl = await readObl(rid, A);
    assert.equal(
      obl.contraparteUid,
      null,
      `contraparteUid debe persistirse como null (${label})`,
    );
    assert.deepEqual(
      obl.participantes,
      [A],
      `participantes = [registrador] (${label})`,
    );
    assert.ok(
      !("confirmadaPor" in obl),
      `sin confirmadaPor para externa (${label})`,
    );
  }

  // Tipo inválido (número): VALIDACION del cliente y SIN escritura residual.
  // La verificación de no-residuo es con acceso rules-disabled: bajo reglas,
  // leer un doc inexistente deniega (resource null en L219, sin leak de
  // existencia — ver nota H12), no devuelve exists()===false.
  const ridBad = "h14_ext_bad_type";
  let err = null;
  await submitReintegro({
    db: dbAs(A),
    uid: A,
    uidNombre: "Alice",
    sentido: "por_devolver",
    monto: 250,
    contraparteUid: 123,
    contraparteNombre: "Proveedor",
    groupId: null,
    concepto: "Alta con tipo inválido",
    detalle: null,
    movimientoInicial: "ninguno",
    rid: ridBad,
  }).catch((e) => {
    err = e;
  });
  assert.ok(err instanceof ReintegroError, "tipo inválido → ReintegroError");
  assert.equal(err?.code, "VALIDACION");
  let snapBad;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    snapBad = await getDoc(doc(ctx.firestore(), "reintegros", ridBad));
  });
  assert.equal(
    snapBad.exists(),
    false,
    "sin escritura residual con tipo inválido",
  );
});

// ═══ Suscripción: 0 obligaciones, alta nueva, TANDA, cleanup ═══

test("HS0+HS1 — suscripción: 0 obls emite vacío (sin D1 lista vacía); alta nueva re-emite", async () => {
  const dbSub = dbAs(SUB1);
  const collector = createCollector(dbSub, SUB1);

  // Primera emisión: sin obligaciones, sin devoluciones (D1 no se suscribe)
  const first = await collector.waitFor(
    (d) => d.obligaciones.length === 0 && d.devoluciones.length === 0,
  );
  assert.deepEqual(first.obligaciones, []);
  assert.deepEqual(first.devoluciones, []);

  // Alta nueva vía helper real → R1' re-emite → D1 se suscribe (1 rid)
  const { rid } = await submitReintegro({
    db: dbSub,
    uid: SUB1,
    uidNombre: "Sub1",
    sentido: "por_cobrar",
    monto: 100,
    contraparteUid: null,
    contraparteNombre: "Externo",
    groupId: null,
    concepto: "Sub test",
    detalle: null,
    movimientoInicial: "ninguno",
  });

  const second = await collector.waitFor(
    (d) => d.obligaciones.length === 1 && d.devoluciones.length === 0,
  );
  assert.equal(second.obligaciones[0].id, rid);
  collector.unsub();
});

test("HS2 — batching TANDA: 12 obls con entrega → 12 entregas traídas (2 tandas)", async () => {
  // Sembrar 12 obls externas para SUB2, cada una con 1 entrega
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const fsdb = ctx.firestore();
    for (let i = 0; i < 12; i++) {
      const rid = `hs2_${i}`;
      await setDoc(doc(fsdb, "reintegros", rid), {
        registradoPor: SUB2,
        registradoPorNombre: "Sub2",
        contraparteUid: null,
        contraparteNombre: "Externo",
        participantes: [SUB2],
        sentido: "por_cobrar",
        monto: 100,
        devuelto: 10,
        movimientoInicial: "ninguno",
        concepto: `Tanda ${i}`,
        gastoVinculadoId: null,
        createdAt: Timestamp.now(),
      });
      await setDoc(doc(fsdb, "reintegro_devoluciones", `hs2d_${i}`), {
        reintegroId: rid,
        monto: 10,
        realizadoPorUid: null,
        realizadoPorNombre: "Externo",
        registradoPor: SUB2,
        registradoPorNombre: "Sub2",
        fechaPago: Timestamp.now(),
        detalle: null,
        createdAt: Timestamp.now(),
      });
    }
  });

  const collector = createCollector(dbAs(SUB2), SUB2);
  const snap = await collector.waitFor(
    (d) => d.obligaciones.length === 12 && d.devoluciones.length === 12,
  );
  assert.equal(snap.obligaciones.length, 12);
  assert.equal(snap.devoluciones.length, 12, "las 12 entregas traídas vía 2 tandas");
  // Verificar que TANDA es la constante esperada
  assert.equal(TANDA, 10);
  collector.unsub();
});

test("HS3 — cleanup: unsubscribe no lanza errores ni deja emisiones", async () => {
  const dbSub = dbAs(SUB3);
  const collector = createCollector(dbSub, SUB3);

  await collector.waitFor((d) => d.obligaciones.length === 0);
  collector.unsub();
  await sleep(200);
  assert.equal(collector.error, null, "sin errores tras unsub");
  const afterUnsub = collector.emissions.length;
  await sleep(200);
  assert.equal(
    collector.emissions.length,
    afterUnsub,
    "sin emisiones nuevas tras unsub",
  );
});

test("HS4 — cleanup tras emitir R1' con datos: sin errores ni emisiones tras unsub", async () => {
  // Sembrar 1 obl para SUB4, esperar a que R1' emita con datos, luego unsub.
  await seedObl("hs4_rid", baseObl({
    registradoPor: SUB4,
    contraparteUid: null,
    participantes: [SUB4],
    monto: 100,
  }));
  const collector = createCollector(dbAs(SUB4), SUB4);
  const snap = await collector.waitFor(
    (d) => d.obligaciones.length === 1,
  );
  assert.equal(snap.obligaciones[0].id, "hs4_rid");
  // D1 también emite (1 rid → tanda con ese rid)
  assert.ok(Array.isArray(snap.devoluciones));

  collector.unsub();
  await sleep(200);
  assert.equal(collector.error, null, "sin errores tras unsub con datos");
  const afterUnsub = collector.emissions.length;
  await sleep(200);
  assert.equal(
    collector.emissions.length,
    afterUnsub,
    "sin emisiones nuevas tras unsub con datos",
  );
});

// ═══ 4.3b — Edición de monto (H15–H21) ═══

function baseEntrega(rid, over = {}) {
  return {
    reintegroId: rid,
    monto: 300,
    realizadoPorUid: A,
    realizadoPorNombre: "Alice",
    registradoPor: A,
    registradoPorNombre: "Alice",
    fechaPago: Timestamp.now(),
    detalle: null,
    ...over,
  };
}

async function readEdicionEventos(rid, asUid = A) {
  const snap = await getDocs(
    query(
      collection(dbAs(asUid), "reintegros", rid, "eventos"),
      where("tipo", "==", "edicion"),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ═══ Caso 15 — editar entrega (baja): delta exacto + evento completo ═══

test("H15 — editar entrega (baja): delta exacto, evento completo edicion/entrega, lectura como contraparte", async () => {
  const rid = "h15_edit";
  const did = "h15_edit_e1";
  await seedObl(rid, baseObl({ monto: 1000, devuelto: 300 }));
  await seedEntrega(did, baseEntrega(rid, { monto: 300 }));

  await editarEntrega({ db: dbAs(A), uid: A, did, monto: 200 });

  const obl = await readObl(rid, A);
  assert.equal(obl.devuelto, 200, "delta exacto: 300 - 300 + 200");
  const entregas = await readEntregas(rid, A);
  assert.equal(entregas.length, 1);
  const e = entregas[0];
  assert.equal(e.monto, 200);
  assert.equal(e.reintegroId, rid);
  assert.equal(e.realizadoPorNombre, "Alice", "demás campos intactos");
  assert.equal(e.registradoPor, A);
  assert.ok(e.fechaPago instanceof Timestamp, "fechaPago intacta");
  assert.ok(assertDevueltoConsistente(obl, entregas), "D-7 ok");

  // Evento con registradoPor, entidad, entregaId y createdAt de servidor,
  // leído con el filtro where("tipo","==","edicion") como la otra parte.
  const evs = await readEdicionEventos(rid, B);
  assert.equal(evs.length, 1, "un evento edicion");
  const ev = evs[0];
  assert.equal(ev.tipo, "edicion");
  assert.equal(ev.entidad, "entrega");
  assert.equal(ev.entregaId, did);
  assert.equal(ev.montoAnterior, 300);
  assert.equal(ev.montoNuevo, 200);
  assert.equal(ev.registradoPor, A);
  assert.ok(ev.createdAt instanceof Timestamp, "createdAt de servidor");
});

// ═══ Caso 15b — contraparte edita entrega (ambas partes) ═══

test("H15b — contraparte edita la entrega: permitido (ambas partes); evento registradoPor == B", async () => {
  const rid = "h15b_edit";
  const did = "h15b_edit_e1";
  await seedObl(rid, baseObl({ monto: 1000, devuelto: 300 }));
  await seedEntrega(did, baseEntrega(rid, { monto: 300 }));

  await editarEntrega({ db: dbAs(B), uid: B, did, monto: 400 });

  const obl = await readObl(rid, B);
  assert.equal(obl.devuelto, 400, "delta exacto: 300 - 300 + 400");
  const entregas = await readEntregas(rid, B);
  assert.equal(entregas[0].monto, 400);
  assert.ok(assertDevueltoConsistente(obl, entregas), "D-7 ok");

  const evs = await readEdicionEventos(rid, A);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].registradoPor, B, "evento atribuido a la contraparte");
  assert.equal(evs[0].montoAnterior, 300);
  assert.equal(evs[0].montoNuevo, 400);
});

// ═══ Caso 16 — subir hasta agotar saldo → liquidado ═══

test("H16 — subir pago hasta agotar saldo: liquidado (migra a Saldados), D-7 ok", async () => {
  const rid = "h16_liq";
  const did = "h16_liq_e1";
  await seedObl(rid, baseObl({ monto: 500, devuelto: 300 }));
  await seedEntrega(did, baseEntrega(rid, { monto: 300 }));

  await editarEntrega({ db: dbAs(A), uid: A, did, monto: 500 });

  const obl = await readObl(rid, A);
  assert.equal(obl.devuelto, 500);
  assert.equal(saldoDe(obl), 0);
  assert.equal(estadoDe(obl), "liquidado", "migra a la pestaña Saldados");
  const entregas = await readEntregas(rid, A);
  assert.equal(entregas[0].monto, 500);
  assert.ok(assertDevueltoConsistente(obl, entregas), "D-7 ok");
});

// ═══ Caso 16b — subir de más → SALDO_INSUFICIENTE sin escritura ═══

test("H16b — subir de más (resultado > monto): SALDO_INSUFICIENTE sin escritura", async () => {
  const rid = "h16b_over";
  const did = "h16b_over_e1";
  await seedObl(rid, baseObl({ monto: 500, devuelto: 300 }));
  await seedEntrega(did, baseEntrega(rid, { monto: 200 }));
  await seedEntrega("h16b_over_e2", baseEntrega(rid, { monto: 100 }));

  // Resultante = 300 - 200 + 401 = 501 > 500 → rechazado (PO-7/DC-2).
  await assert.rejects(
    () => editarEntrega({ db: dbAs(A), uid: A, did, monto: 401 }),
    (err) => {
      assert.ok(err instanceof ReintegroError);
      assert.equal(err.code, "SALDO_INSUFICIENTE");
      return true;
    },
  );

  const obl = await readObl(rid, A);
  assert.equal(obl.devuelto, 300, "devuelto intacto");
  const entregas = await readEntregas(rid, A);
  const e1 = entregas.find((d) => d.id === did);
  assert.equal(e1.monto, 200, "monto intacto");
  const evs = await readEdicionEventos(rid, A);
  assert.equal(evs.length, 0, "sin evento edicion");
});

// ═══ Caso 17 — guardas de cliente sobre liquidada/condonada/eliminada ═══
//
// NOTA (documentada en EVIDENCIA-4.3.md): las reglas NO bloquean editar una
// obligación LIQUIDADA (saldo 0) — la única barrera es esta guarda de
// cliente; condonada y eliminada también las bloquean las reglas.

test("H17 — guardas de cliente: LIQUIDADA/CONDONADA/ELIMINADA sin escritura (LIQUIDADA es única barrera)", async () => {
  // (a) liquidada: saldo 0 → única barrera: guarda de cliente
  const ridL = "h17_liq";
  await seedObl(ridL, baseObl({ monto: 500, devuelto: 500 }));
  await seedEntrega("h17_liq_e1", baseEntrega(ridL, { monto: 500 }));
  await assert.rejects(
    () => editarEntrega({ db: dbAs(A), uid: A, did: "h17_liq_e1", monto: 400 }),
    (err) => {
      assert.ok(err instanceof ReintegroError);
      assert.equal(err.code, "LIQUIDADA");
      return true;
    },
  );
  assert.equal((await readObl(ridL, A)).devuelto, 500, "sin escritura");
  assert.equal((await readEdicionEventos(ridL, A)).length, 0);

  // (b) condonada
  const ridC = "h17_cond";
  await seedObl(
    ridC,
    baseObl({
      monto: 500,
      devuelto: 100,
      condonacion: { condonadaPor: A, condonadaAt: Timestamp.now() },
    }),
  );
  await seedEntrega("h17_cond_e1", baseEntrega(ridC, { monto: 100 }));
  await assert.rejects(
    () =>
      editarEntrega({ db: dbAs(A), uid: A, did: "h17_cond_e1", monto: 200 }),
    (err) => {
      assert.equal(err.code, "CONDONADA");
      return true;
    },
  );
  assert.equal((await readEntregas(ridC, A))[0].monto, 100, "sin escritura");

  // (c) eliminada (obligación)
  const ridE = "h17_elim";
  await seedObl(
    ridE,
    baseObl({
      monto: 500,
      devuelto: 100,
      eliminacion: { eliminadaPor: A, eliminadaAt: Timestamp.now() },
    }),
  );
  await seedEntrega("h17_elim_e1", baseEntrega(ridE, { monto: 100 }));
  await assert.rejects(
    () =>
      editarEntrega({ db: dbAs(A), uid: A, did: "h17_elim_e1", monto: 200 }),
    (err) => {
      assert.equal(err.code, "ELIMINADA");
      return true;
    },
  );
  assert.equal((await readObl(ridE, A)).devuelto, 100, "sin escritura");

  // (d) entrega eliminada
  const ridD = "h17_deliv";
  await seedObl(ridD, baseObl({ monto: 500, devuelto: 200 }));
  await seedEntrega(
    "h17_deliv_e1",
    baseEntrega(ridD, {
      monto: 200,
      eliminacion: { eliminadaPor: A, eliminadaAt: Timestamp.now() },
    }),
  );
  await assert.rejects(
    () =>
      editarEntrega({ db: dbAs(A), uid: A, did: "h17_deliv_e1", monto: 300 }),
    (err) => {
      assert.equal(err.code, "ELIMINADA");
      return true;
    },
  );
  assert.equal((await readObl(ridD, A)).devuelto, 200, "sin escritura");
});

// ═══ Caso 18 — editar obligación (devuelto == 0): positiva + evento ═══

test("H18 — editar obligación con devuelto == 0: monto nuevo, evento edicion/obligacion", async () => {
  const rid = "h18_edit";
  await seedObl(rid, baseObl({ monto: 500, devuelto: 0 }));

  await editarObligacion({ db: dbAs(A), uid: A, rid, monto: 700 });

  const obl = await readObl(rid, A);
  assert.equal(obl.monto, 700);
  assert.equal(obl.devuelto, 0, "devuelto intacto");
  const evs = await readEdicionEventos(rid, B);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].entidad, "obligacion");
  assert.equal(evs[0].montoAnterior, 500);
  assert.equal(evs[0].montoNuevo, 700);
  assert.equal(evs[0].registradoPor, A);
  assert.ok(evs[0].createdAt instanceof Timestamp, "createdAt de servidor");
});

// ═══ Caso 18b — no registrador → NO_REGISTRADOR ═══

test("H18b — editar obligación sin ser registrador: NO_REGISTRADOR sin escritura", async () => {
  const rid = "h18b_noreg";
  await seedObl(rid, baseObl({ monto: 500, devuelto: 0 }));

  await assert.rejects(
    () => editarObligacion({ db: dbAs(B), uid: B, rid, monto: 700 }),
    (err) => {
      assert.ok(err instanceof ReintegroError);
      assert.equal(err.code, "NO_REGISTRADOR");
      return true;
    },
  );
  assert.equal((await readObl(rid, B)).monto, 500, "monto intacto");
  assert.equal((await readEdicionEventos(rid, B)).length, 0, "sin evento");
});

// ═══ Caso 19 — devuelto > 0 → MONTO_BLOQUEADO ═══

test("H19 — editar obligación con devuelto > 0: MONTO_BLOQUEADO sin escritura", async () => {
  const rid = "h19_block";
  await seedObl(rid, baseObl({ monto: 500, devuelto: 200 }));
  await seedEntrega("h19_block_e1", baseEntrega(rid, { monto: 200 }));

  await assert.rejects(
    () => editarObligacion({ db: dbAs(A), uid: A, rid, monto: 600 }),
    (err) => {
      assert.ok(err instanceof ReintegroError);
      assert.equal(err.code, "MONTO_BLOQUEADO");
      return true;
    },
  );
  assert.equal((await readObl(rid, A)).monto, 500, "monto intacto");
  assert.equal((await readEdicionEventos(rid, A)).length, 0, "sin evento");
});

// ═══ Caso 20 — monto sin cambios: sin escritura ni evento ═══

test("H20 — monto sin cambios (entrega y obligación): MONTO_SIN_CAMBIOS, sin evento", async () => {
  const rid = "h20_same";
  await seedObl(rid, baseObl({ monto: 500, devuelto: 200 }));
  await seedEntrega("h20_same_e1", baseEntrega(rid, { monto: 200 }));

  await assert.rejects(
    () =>
      editarEntrega({ db: dbAs(A), uid: A, did: "h20_same_e1", monto: 200 }),
    (err) => {
      assert.equal(err.code, "MONTO_SIN_CAMBIOS");
      return true;
    },
  );

  const rid2 = "h20_same_obl";
  await seedObl(rid2, baseObl({ monto: 500, devuelto: 0 }));
  await assert.rejects(
    () => editarObligacion({ db: dbAs(A), uid: A, rid: rid2, monto: 500 }),
    (err) => {
      assert.equal(err.code, "MONTO_SIN_CAMBIOS");
      return true;
    },
  );

  assert.equal((await readObl(rid, A)).devuelto, 200, "devuelto intacto");
  assert.equal((await readObl(rid2, A)).monto, 500, "monto intacto");
  assert.equal((await readEdicionEventos(rid, A)).length, 0, "sin evento");
  assert.equal((await readEdicionEventos(rid2, A)).length, 0, "sin evento");
});

// ═══ Caso 21 — concurrencia edición + pago: exactamente uno gana ═══

test("H21 — concurrencia edición + pago nuevo: exactamente uno gana, sin sobregiro, D-7 ok", async () => {
  const rid = "h21_conc";
  const did = "h21_conc_e1";
  await seedObl(rid, baseObl({ monto: 1000, devuelto: 300 }));
  await seedEntrega(did, baseEntrega(rid, { monto: 300 }));
  const dbA = dbAs(A);

  // Ambas dejarían devuelto == 1000 (tope): serializadas, la segunda
  // debe fallar por saldo resultante.
  const edit = () => editarEntrega({ db: dbA, uid: A, did, monto: 1000 });
  const pago = () =>
    submitDevolucion({
      db: dbA,
      uid: A,
      uidNombre: "Alice",
      rid,
      monto: 700,
      realizadoPorUid: A,
      realizadoPorNombre: "Alice",
      fechaPago: Timestamp.now(),
    });

  const results = await Promise.allSettled([edit(), pago()]);
  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");
  assert.equal(fulfilled.length, 1, "exactamente una debe ganar");
  assert.equal(rejected.length, 1, "exactamente una debe fallar");
  const code = rejected[0].reason?.code;
  assert.ok(
    code === "SALDO_INSUFICIENTE" || code === "permission-denied",
    `error del perdedor inesperado: ${code}`,
  );

  const obl = await readObl(rid, A);
  assert.equal(obl.devuelto, 1000, "sin sobregiro: devuelto <= monto");
  assert.equal(saldoDe(obl), 0);
  assert.equal(estadoDe(obl), "liquidado");
  const entregas = await readEntregas(rid, A);
  assert.ok(assertDevueltoConsistente(obl, entregas), "D-7 ok");
});

// ═══ HS5 — re-emisión de R1' al editar el monto (rids sin cambio) ═══
//
// REGRESIÓN del bug latente de 4.1 destapado el 21/10/2026 al validar 4.3b:
// el guard de rids de subscribeReintegros hacía `return` SIN emitir, de modo
// que editar el monto general (escribe SOLO `reintegros`, no toca D1)
// nunca llegaba a la UI (fila/balance/header con el valor viejo). Sin el
// fix, este test queda en timeout.

test("HS5 — editar el monto general re-emite la suscripción: la UI ve el monto nuevo", async () => {
  const rid = "hs5_rid";
  await seedObl(rid, baseObl({
    registradoPor: SUB5,
    contraparteUid: null,
    participantes: [SUB5],
    monto: 200,
    devuelto: 0,
  }));
  const collector = createCollector(dbAs(SUB5), SUB5);
  const inicial = await collector.waitFor((d) => d.obligaciones.length === 1);
  assert.equal(inicial.obligaciones[0].monto, 200, "monto inicial visible");

  await editarObligacion({ db: dbAs(SUB5), uid: SUB5, rid, monto: 2000 });

  const tras = await collector.waitFor(
    (d) => d.obligaciones[0]?.monto === 2000,
  );
  assert.equal(tras.obligaciones[0].monto, 2000, "monto nuevo en emisión");
  // D1 intacta (sin cambio del conjunto de rids): devoluciones sigue en []
  // y la emisión trae ambas listas.
  assert.ok(Array.isArray(tras.devoluciones));
  assert.equal(tras.devoluciones.length, 0, "D1 sin reiniciarse");

  collector.unsub();
  await sleep(100);
  assert.equal(collector.error, null, "sin errores de suscripción");
});

// ═══ Caso 22 — espejo por_cobrar + dinero (4.3c) ═══
//
// Tabla del espejo (solo contraparte miembro): por_cobrar con dinero →
// la contraparte ve ENTRADA en el mes de la alta. El registrador no cambia
// (su salida automática sigue). La contraparte nunca bookkea una salida
// propia de un doc ajeno (garantía de no duplicación).

test("H22 — espejo por_cobrar dinero: registrador ve salida, contraparte miembro ve entrada en la alta", () => {
  const start = new Date(2026, 8, 1); // septiembre 2026
  const nextStart = new Date(2026, 9, 1);
  const createdAt = Timestamp.fromDate(new Date(2026, 8, 15));
  const obl = {
    id: "h22_dinero",
    registradoPor: A,
    contraparteUid: B,
    participantes: [A, B],
    sentido: "por_cobrar",
    monto: 800,
    devuelto: 0,
    movimientoInicial: "salida",
    movimientoInicialTipo: "dinero",
    createdAt,
  };
  const obligaciones = [obl];
  const entregas = [];

  // Registrador A: su salida automática, sin cambios.
  assert.equal(
    salidasDelMes({ obligaciones, entregas, uid: A, start, nextStart }),
    800,
    "registrador A: salida en el mes de la alta",
  );
  assert.equal(
    entradasDelMes({ obligaciones, entregas, uid: A, start, nextStart }),
    0,
    "registrador A: sin entradas",
  );

  // Contraparte B (miembro): entrada espejo; jamás salida propia ajena.
  assert.equal(
    entradasDelMes({ obligaciones, entregas, uid: B, start, nextStart }),
    800,
    "espejo: contraparte B ve entrada en el mes de la alta",
  );
  assert.equal(
    salidasDelMes({ obligaciones, entregas, uid: B, start, nextStart }),
    0,
    "no duplica: B no bookkea salida propia del doc ajeno",
  );
});

// ═══ Caso 23 — espejo por_cobrar + ítem (4.3c) ═══

test("H23 — espejo por_cobrar ítem: la contraparte no bookkea nada", () => {
  const start = new Date(2026, 8, 1);
  const nextStart = new Date(2026, 9, 1);
  const createdAt = Timestamp.fromDate(new Date(2026, 8, 15));
  const obl = {
    id: "h23_item",
    registradoPor: A,
    contraparteUid: B,
    participantes: [A, B],
    sentido: "por_cobrar",
    monto: 1500,
    devuelto: 0,
    movimientoInicial: "salida",
    movimientoInicialTipo: "item",
    createdAt,
  };
  const obligaciones = [obl];
  const entregas = [];

  assert.equal(
    salidasDelMes({ obligaciones, entregas, uid: A, start, nextStart }),
    1500,
    "registrador A: salida igual (el ítem no cambia su libro)",
  );
  assert.equal(
    entradasDelMes({ obligaciones, entregas, uid: B, start, nextStart }),
    0,
    "ítem: la contraparte B no ve entrada en la alta",
  );
  assert.equal(
    salidasDelMes({ obligaciones, entregas, uid: B, start, nextStart }),
    0,
    "ítem: la contraparte B tampoco ve salida",
  );
});

// ═══ Caso 24 — espejo por_devolver con tick (4.3c) ═══
//
// por_devolver (registra quien recibe) → la contraparte miembro ve
// SIEMPRE su SALIDA en el mes de la alta (aquí con movimientoInicial
// "entrada" porque marcó «Me entró dinero»).

test("H24 — espejo por_devolver con tick: registrador ve entrada, contraparte miembro ve salida en la alta", () => {
  const start = new Date(2026, 8, 1);
  const nextStart = new Date(2026, 9, 1);
  const createdAt = Timestamp.fromDate(new Date(2026, 8, 15));
  const obl = {
    id: "h24_dev_dinero",
    registradoPor: B,
    contraparteUid: A,
    participantes: [A, B],
    sentido: "por_devolver",
    monto: 600,
    devuelto: 0,
    movimientoInicial: "entrada",
    createdAt,
  };
  const obligaciones = [obl];
  const entregas = [];

  // Registrador B (recibe): entrada propia, sin cambios.
  assert.equal(
    entradasDelMes({ obligaciones, entregas, uid: B, start, nextStart }),
    600,
    "registrador B: entrada en el mes de la alta",
  );
  assert.equal(
    salidasDelMes({ obligaciones, entregas, uid: B, start, nextStart }),
    0,
    "registrador B: sin salidas",
  );

  // Contraparte A (la que entregó): SIEMPRE salida en la alta.
  assert.equal(
    salidasDelMes({ obligaciones, entregas, uid: A, start, nextStart }),
    600,
    "espejo: contraparte A ve salida en el mes de la alta",
  );
  assert.equal(
    entradasDelMes({ obligaciones, entregas, uid: A, start, nextStart }),
    0,
    "no duplica: A no bookkea entrada propia del doc ajeno",
  );
});

// ═══ Caso 25 — espejo por_devolver sin tick / ítem (4.3c) ═══
//
// Decisión: en por_devolver la contraparte miembro ve SIEMPRE salida en
// el mes de la alta, incluso cuando el registrador registró un ítem
// (movimientoInicial "ninguno").

test("H25 — espejo por_devolver ítem: registrador 0, contraparte miembro ve salida igual", () => {
  const start = new Date(2026, 8, 1);
  const nextStart = new Date(2026, 9, 1);
  const createdAt = Timestamp.fromDate(new Date(2026, 8, 15));
  const obl = {
    id: "h25_dev_item",
    registradoPor: B,
    contraparteUid: A,
    participantes: [A, B],
    sentido: "por_devolver",
    monto: 400,
    devuelto: 0,
    movimientoInicial: "ninguno",
    createdAt,
  };
  const obligaciones = [obl];
  const entregas = [];

  assert.equal(
    entradasDelMes({ obligaciones, entregas, uid: B, start, nextStart }),
    0,
    "registrador B con ítem: sin entrada",
  );
  assert.equal(
    salidasDelMes({ obligaciones, entregas, uid: A, start, nextStart }),
    400,
    "espejo: la contraparte A ve salida en la alta SIEMPRE (ítem incluido)",
  );
  assert.equal(
    entradasDelMes({ obligaciones, entregas, uid: A, start, nextStart }),
    0,
    "contraparte A: sin entradas",
  );
});

// ═══ Caso 26 — externa / no participante: sin espejo (4.3c) ═══

test("H26 — externa: sin espejo para nadie (el uid externo no está en participantes)", () => {
  const start = new Date(2026, 8, 1);
  const nextStart = new Date(2026, 9, 1);
  const createdAt = Timestamp.fromDate(new Date(2026, 8, 15));
  const obl = {
    id: "h26_ext",
    registradoPor: A,
    contraparteUid: null,
    participantes: [A],
    sentido: "por_cobrar",
    monto: 500,
    devuelto: 0,
    movimientoInicial: "salida",
    movimientoInicialTipo: "dinero",
    createdAt,
  };
  const obligaciones = [obl];
  const entregas = [];

  // Un uid ajeno (no participante) no ve nada, aunque el doc diga dinero.
  assert.equal(
    entradasDelMes({ obligaciones, entregas, uid: B, start, nextStart }),
    0,
    "no participante: sin espejo de entrada",
  );
  assert.equal(
    salidasDelMes({ obligaciones, entregas, uid: B, start, nextStart }),
    0,
    "no participante: sin espejo de salida",
  );
  // El registrador mantiene su libro.
  assert.equal(
    salidasDelMes({ obligaciones, entregas, uid: A, start, nextStart }),
    500,
    "registrador A: salida sin cambios",
  );
});

// ═══ Caso 27 — retrocompat: vieja sin movimientoInicialTipo (4.3c) ═══
//
// Obligaciones existentes (creadas antes de 4.3c) no traen el campo: para
// el espejo se interpretan como dinero (decisión 4.3c).

test("H27 — retrocompat: por_cobrar vieja sin movimientoInicialTipo → el espejo la trata como dinero", () => {
  const start = new Date(2026, 8, 1);
  const nextStart = new Date(2026, 9, 1);
  const createdAt = Timestamp.fromDate(new Date(2026, 8, 15));
  const obl = {
    id: "h27_vieja",
    registradoPor: A,
    contraparteUid: B,
    participantes: [A, B],
    sentido: "por_cobrar",
    monto: 350,
    devuelto: 0,
    movimientoInicial: "salida",
    createdAt,
    // sin movimientoInicialTipo (doc previo a 4.3c)
  };
  const obligaciones = [obl];
  const entregas = [];

  assert.equal(
    entradasDelMes({ obligaciones, entregas, uid: B, start, nextStart }),
    350,
    "vieja sin campo: espejo de dinero (entrada para B en la alta)",
  );
  assert.equal(
    salidasDelMes({ obligaciones, entregas, uid: A, start, nextStart }),
    350,
    "registrador A: salida sin cambios",
  );
  assert.equal(
    tipoDineroDe(obl),
    null,
    "pero SIN chip: por_cobrar sin campo no muestra chip",
  );
});

// ═══ Caso 28 — movimientoInicialTipo inválido (4.3c, ajuste b) ═══
//
// Un valor distinto de "dinero"/"item" se trata como AUSENTE: el espejo
// lo interpreta como dinero y el chip no se muestra.

test("H28 — movimientoInicialTipo inválido: espejo como dinero, chip ausente", () => {
  const start = new Date(2026, 8, 1);
  const nextStart = new Date(2026, 9, 1);
  const createdAt = Timestamp.fromDate(new Date(2026, 8, 15));
  const obl = {
    id: "h28_invalido",
    registradoPor: A,
    contraparteUid: B,
    participantes: [A, B],
    sentido: "por_cobrar",
    monto: 1000,
    devuelto: 0,
    movimientoInicial: "salida",
    movimientoInicialTipo: "moneda",
    createdAt,
  };
  const obligaciones = [obl];
  const entregas = [];

  assert.equal(
    entradasDelMes({ obligaciones, entregas, uid: B, start, nextStart }),
    1000,
    "valor desconocido → se asume dinero para el espejo",
  );
  assert.equal(
    tipoDineroDe(obl),
    null,
    "valor desconocido → sin chip",
  );
});

// ═══ Caso 29 — espejo con monto editado vía editarObligacion (4.3c) ═══
//
// El espejo usa el monto VIGENTE del documento: si el registrador edita el
// monto (4.3b, devuelto == 0), ambos libros ven el monto nuevo.

test("H29 — espejo con monto editado: contraparte ve el monto nuevo", async () => {
  const rid = "h29_espejo_edit";
  await seedObl(
    rid,
    baseObl({
      sentido: "por_cobrar",
      movimientoInicial: "salida",
      movimientoInicialTipo: "dinero",
      monto: 1000,
      devuelto: 0,
    }),
  );

  await editarObligacion({ db: dbAs(A), uid: A, rid, monto: 1500 });

  const obl = await readObl(rid, A);
  assert.equal(obl.monto, 1500, "monto editado");

  const start = new Date(2026, 9, 1); // octubre 2026 (createdAt = ahora)
  const nextStart = new Date(2026, 10, 1);
  const obligaciones = [obl];
  const entregas = [];

  assert.equal(
    salidasDelMes({ obligaciones, entregas, uid: A, start, nextStart }),
    1500,
    "registrador A: salida con el monto editado",
  );
  assert.equal(
    entradasDelMes({ obligaciones, entregas, uid: B, start, nextStart }),
    1500,
    "espejo: contraparte B ve el monto editado en la alta",
  );
});

// ═══ Caso 30 — tipoDineroDe: derivación del chip (4.3c) ═══
//
// por_devolver → de movimientoInicial; por_cobrar → de
// movimientoInicialTipo (ausente o desconocido → null = sin chip).

test("H30 — tipoDineroDe: chip Dinero/Ítem según sentido y campos", () => {
  // por_cobrar con campo
  assert.equal(
    tipoDineroDe({ sentido: "por_cobrar", movimientoInicialTipo: "dinero" }),
    "dinero",
  );
  assert.equal(
    tipoDineroDe({ sentido: "por_cobrar", movimientoInicialTipo: "item" }),
    "item",
  );
  // por_cobrar sin campo (vieja) o inválido → sin chip
  assert.equal(
    tipoDineroDe({ sentido: "por_cobrar", movimientoInicial: "salida" }),
    null,
  );
  assert.equal(
    tipoDineroDe({ sentido: "por_cobrar", movimientoInicialTipo: "otra" }),
    null,
  );
  // por_devolver → desde movimientoInicial (no usa el campo nuevo)
  assert.equal(
    tipoDineroDe({ sentido: "por_devolver", movimientoInicial: "entrada" }),
    "dinero",
  );
  assert.equal(
    tipoDineroDe({ sentido: "por_devolver", movimientoInicial: "ninguno" }),
    "item",
  );
});

// ═══ Caso 31 — alta con movimientoInicialTipo (4.3c) ═══
//
// El campo solo viaja en por_cobrar (dinero = tick marcado, item =
// desmarcado; default de la UI = desmarcado = item, decisión 21/10/2026).
// por_devolver lo lleva codificado en movimientoInicial: si igual llegara
// el campo, o si el valor no es dinero/item, es VALIDACION sin escritura.

test("H31 — submitReintegro con movimientoInicialTipo: dinero/item en por_cobrar, ausente y rechazos", async () => {
  // a) por_cobrar CON tick (dinero) — marcado a mano en la UI (el default
  // es desmarcado = item)
  const { rid: ridDinero } = await submitReintegro({
    db: dbAs(A),
    uid: A,
    uidNombre: "Alice",
    sentido: "por_cobrar",
    monto: 800,
    contraparteUid: B,
    contraparteNombre: "Bob",
    groupId: null,
    concepto: "Préstamo con dinero",
    detalle: null,
    movimientoInicial: "salida",
    movimientoInicialTipo: "dinero",
  });
  const oblD = await readObl(ridDinero, A);
  assert.equal(oblD.movimientoInicialTipo, "dinero");
  assert.equal(oblD.movimientoInicial, "salida", "mi salida automática intacta");

  // b) por_cobrar SIN tick (ítem)
  const { rid: ridItem } = await submitReintegro({
    db: dbAs(A),
    uid: A,
    uidNombre: "Alice",
    sentido: "por_cobrar",
    monto: 1500,
    contraparteUid: B,
    contraparteNombre: "Bob",
    groupId: null,
    concepto: "Notebook en préstamo",
    detalle: null,
    movimientoInicial: "salida",
    movimientoInicialTipo: "item",
  });
  const oblI = await readObl(ridItem, A);
  assert.equal(oblI.movimientoInicialTipo, "item");
  assert.equal(oblI.movimientoInicial, "salida", "la salida propia no cambia");

  // c) por_devolver SIN el campo (la UI no lo envía) → esquema sin el campo
  const { rid: ridDev } = await submitReintegro({
    db: dbAs(A),
    uid: A,
    uidNombre: "Alice",
    sentido: "por_devolver",
    monto: 600,
    contraparteUid: B,
    contraparteNombre: "Bob",
    groupId: null,
    concepto: "Me prestaron con dinero",
    detalle: null,
    movimientoInicial: "entrada",
  });
  const oblDev = await readObl(ridDev, A);
  assert.ok(
    !("movimientoInicialTipo" in oblDev),
    "por_devolver: sin campo (el dinero/ítem vive en movimientoInicial)",
  );

  // d) por_devolver CON el campo → VALIDACION
  await assert.rejects(
    () =>
      submitReintegro({
        db: dbAs(A),
        uid: A,
        uidNombre: "Alice",
        sentido: "por_devolver",
        monto: 600,
        contraparteUid: B,
        contraparteNombre: "Bob",
        groupId: null,
        concepto: "Mal sentido",
        detalle: null,
        movimientoInicial: "entrada",
        movimientoInicialTipo: "dinero",
      }),
    (err) => {
      assert.ok(err instanceof ReintegroError);
      assert.equal(err.code, "VALIDACION");
      return true;
    },
  );

  // e) valor inválido → VALIDACION
  await assert.rejects(
    () =>
      submitReintegro({
        db: dbAs(A),
        uid: A,
        uidNombre: "Alice",
        sentido: "por_cobrar",
        monto: 800,
        contraparteUid: B,
        contraparteNombre: "Bob",
        groupId: null,
        concepto: "Valor raro",
        detalle: null,
        movimientoInicial: "salida",
        movimientoInicialTipo: "moneda",
      }),
    (err) => {
      assert.ok(err instanceof ReintegroError);
      assert.equal(err.code, "VALIDACION");
      return true;
    },
  );
});
