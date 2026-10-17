// tests/harness/reintegros.harness.test.mjs
// Harness del módulo Reintegros (4.1) contra el emulador demo-finanzas.
// Prueba los helpers REALES (submitReintegro/submitDevolucion) y la
// suscripción (subscribeReintegros) + funciones puras del modelo.
//
// Ningún archivo importado por este harness carga la config real de
// Firebase: los helpers reciben `db` como parámetro (ajuste 1, 4.1).
//
// Casos de §14.1 (PROPUESTA-ETAPA-3) + ajustes aprobados del plan 4.1:
//   1  (H1)   alta ambos sentidos, participantes + evento
//   2  (H2)   devolución parcial miembro confirmado
//   2b (H2b)  devolución parcial externa
//   3  (H3)   devolución completa → liquidado
//   3b (H3b)  rechazo SIN_CONFIRMAR sobre miembro sin confirmar
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
//   13 (H13)  entradas/salidas I-8: movimientoInicial solo si registradoPor === uid
//   14 (H14)  contraparteUid externa '': null (ajuste 6, 4.2) + tipo inválido
//   +  (HS0)  suscripción con 0 obligaciones (sin D1 con lista vacía)
//   +  (HS1)  alta nueva → re-emisión de la suscripción
//   +  (HS2)  batching TANDA: 12 obls → 12 entregas traídas
//   +  (HS3)  cleanup: unsubscribe sin errores
//   +  (HS4)  cleanup tras emitir R1' con datos: sin errores ni emisiones

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
import {
  sentidoDelViewer,
  saldoDe,
  estadoDe,
  assertDevueltoConsistente,
  sumaEntregasNoEliminadas,
  entradasDelMes,
  salidasDelMes,
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
    confirmadaPor: B,
    confirmadaAt: Timestamp.now(),
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

  // 1a: miembro (por_cobrar) — confirmadaPor: null presente
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
  assert.ok("confirmadaPor" in oblM, "miembro: confirmadaPor presente");
  assert.equal(oblM.confirmadaPor, null);
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

// ═══ Caso 2 — devolución parcial miembro confirmado ═══

test("H2 — devolución parcial sobre miembro confirmado: devuelto baja, saldo > 0, estado parcial, D-7 ok", async () => {
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

// ═══ Caso 3b — rechazo SIN_CONFIRMAR sobre miembro sin confirmar ═══

test("H3b — miembro sin confirmar: submitDevolucion lanza SIN_CONFIRMAR, sin escritura", async () => {
  const rid = "h3b_sinconfirmar";
  // Miembro pendiente de confirmación (confirmadaPor: null)
  await seedObl(rid, baseObl({ confirmadaPor: null, monto: 1000, devuelto: 0 }));

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
      assert.ok(err instanceof ReintegroError, "debe ser ReintegroError");
      assert.equal(err.code, "SIN_CONFIRMAR");
      return true;
    },
  );

  const obl = await readObl(rid, A);
  assert.equal(obl.devuelto, 0, "sin escritura parcial");
  const entregas = await readEntregas(rid, A);
  assert.equal(entregas.length, 0, "sin entrega creada");
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

// ═══ Caso 13 — I-8: movimientoInicial solo si registradoPor === uid ═══
//
// §6.2: entradas/salidas del mes suman el movimientoInicial SOLO de las
// obligaciones creadas por el usuario (registradoPor === uid). La contraparte
// NO cuenta el movimientoInicial ajeno: el registrador lo registró en SU libro,
// no en el de la contraparte (I-8, atribución).

test("H13 — entradas/salidas I-8: movimientoInicial propio sí, ajeno no (contraparte)", () => {
  const start = new Date(2026, 9, 1); // octubre 2026
  const nextStart = new Date(2026, 10, 1); // noviembre 2026
  const createdAt = Timestamp.fromDate(new Date(2026, 9, 15));

  // Obl CREADA POR B (registradoPor=B), sentido por_cobrar, movimientoInicial
  // "salida" (B ya registró el gasto en SU libro). A es la contraparte.
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

  // Vista de A (contraparte): la salida de B NO cuenta (0).
  assert.equal(
    salidasDelMes({ obligaciones, entregas, uid: A, start, nextStart }),
    0,
    "contraparte A NO cuenta el movimientoInicial ajeno de B (I-8)",
  );
  assert.equal(
    entradasDelMes({ obligaciones, entregas, uid: A, start, nextStart }),
    0,
    "contraparte A: sin entradas",
  );
});

// ═══ Caso 14 — contraparteUid externa: '', null y undefined → null ═══
//
// Ajuste 6 (4.2): la UI puede enviar "" (estado vacío del selector) o
// undefined; el helper debe normalizarlos a null (shape de reglas para
// externa: sin confirmadaPor, participantes solo con el registrador). ""
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
