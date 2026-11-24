// tests/harness/balance.harness.test.mjs
// 5.1 — Balance consolidado: adaptador REAL (getDocs) + colecciones reales del
// emulador demo-finanzas, con las reglas de firestore.rules.
//
// Cubre el §5.1.13 del plan aprobado: fixture de octubre (gastos, fijos,
// ingresos, reintegros con los cuatro casos de caja, condonaciones e
// inversiones), stock al corte con pago posterior, legacy, dos grupos, error
// tipado, una lectura para N meses, tandas de 10 y la paridad con el stock
// actual. Sin suscripciones y sin escrituras desde el adaptador.
//
// Cada caso usa uids/grupos propios para aislar los fixtures.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, writeBatch, Timestamp } from "firebase/firestore";

import balanceDelMes, {
  cargarDatosBalance,
} from "../../app/balance/services/balanceDelMes.js";
import { calcularBalanceDelMes } from "../../app/balance/helpers/balance.js";
import {
  saldoDe,
  sentidoDelViewer,
} from "../../app/reintegros/helpers/modelo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rulesSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "firestore.rules"),
  "utf8",
);

// ── Uids / grupos ────────────────────────────────────────────────────────
const BA = "uid_bal_a";
const BB = "uid_bal_b";
const BG = "bal_g1";

const B4 = "uid_bal_legacy";
const B5A = "uid_bal5_a";
const B5B = "uid_bal5_b";
const B6 = "uid_bal6";
const B7A = "uid_bal7_a";
const B7B = "uid_bal7_b";
const BG7 = "bal_g7";
const B9A = "uid_bal9_a";
const B9B = "uid_bal9_b";

// Diciembre: octubre y noviembre quedan cerrados (corte = fin de mes).
const AHORA = new Date(2026, 11, 10, 12, 0, 0);
const CORTE_OCTUBRE = new Date(2026, 9, 31, 23, 59, 59, 999);

let testEnv = null;

function ts(anio, mes, dia, hora = 0, minuto = 0) {
  return Timestamp.fromDate(new Date(anio, mes - 1, dia, hora, minuto));
}

function dbAs(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

async function seedDocumentos(documentos) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const batch = writeBatch(db);

    for (const [coleccion, id, data] of documentos) {
      batch.set(doc(db, coleccion, id), data);
    }

    await batch.commit();
  });
}

function documentos() {
  const docs = [];

  // ── Fixture principal: octubre 2026 ────────────────────────────────────
  docs.push([
    "groups",
    BG,
    { name: "Balance", members: [BA, BB] },
  ]);

  docs.push(
    ["gastos", "g1", { usuario: BA, tipo: "personal", monto: 5000, fecha: ts(2026, 10, 5), createdAt: ts(2026, 10, 5) }],
    ["gastos", "g2", { usuario: BA, tipo: "compartido", groupId: BG, monto: 2000, fecha: ts(2026, 10, 7), createdAt: ts(2026, 10, 7) }],
    ["gastos", "g3", { usuario: BB, tipo: "compartido", groupId: BG, monto: 800, fecha: ts(2026, 10, 8), createdAt: ts(2026, 10, 8) }],
    ["gastos", "g4", { usuario: BA, tipo: "personal", monto: 999, fecha: ts(2026, 11, 1), createdAt: ts(2026, 10, 31) }],
  );

  docs.push(
    ["fixed_expense_entries", "e1", { usuario: BA, periodo: "2026-10", montoTotal: 1500, paidByUid: BA, nombre: "OCA" }],
    ["fixed_expense_entries", "e2", { usuario: BA, periodo: "2026-10", montoTotal: 300, paidByUid: null, nombre: "Otros" }],
    ["fixed_expense_entries", "e3", { usuario: BA, groupId: BG, periodo: "2026-10", montoTotal: 4000, paidByUid: BA, nombre: "Alquiler" }],
    ["fixed_expense_entries", "e4", { usuario: BB, groupId: BG, periodo: "2026-10", montoTotal: 1000, paidByUid: null, nombre: "Luz" }],
    ["fixed_expense_entries", "e5", { usuario: BB, groupId: BG, periodo: "2026-10", montoTotal: 600, paidByUid: BB, nombre: "Internet" }],
    ["fixed_expense_entries", "e6", { usuario: BA, periodo: "2026-09", montoTotal: 700, paidByUid: BA, nombre: "Otro mes" }],
  );

  docs.push(
    ["ingresos", "i1", { usuario: BA, tipo: "sueldo", subtipo: "sueldo_pesos", monto: 20000, moneda: "UYU", fecha: ts(2026, 10, 1), createdAt: ts(2026, 10, 1) }],
    ["ingresos", "i2", { usuario: BA, tipo: "sueldo", subtipo: "sueldo_dolares", monto: 800, moneda: "USD", fecha: ts(2026, 10, 2), createdAt: ts(2026, 10, 2) }],
    ["ingresos", "i3", { usuario: BA, tipo: "otros", monto: 1000, createdAt: ts(2026, 10, 15) }],
  );

  docs.push(
    ["reintegros", "r1", {
      registradoPor: BA, participantes: [BA, BB], sentido: "por_cobrar",
      monto: 3000, devuelto: 1500, movimientoInicial: "salida",
      fecha: ts(2026, 10, 3), createdAt: ts(2026, 10, 3),
    }],
    ["reintegros", "r2", {
      registradoPor: BA, participantes: [BA, BB], sentido: "por_devolver",
      monto: 3000, devuelto: 0, movimientoInicial: "entrada",
      fecha: ts(2026, 10, 4), createdAt: ts(2026, 10, 4),
      condonacion: { condonadaPor: BB, createdAt: ts(2026, 10, 30), motivo: null },
    }],
    ["reintegros", "r4", {
      registradoPor: BA, participantes: [BA, BB], sentido: "por_cobrar",
      monto: 2000, devuelto: 0, movimientoInicial: "ninguno",
      fecha: ts(2026, 10, 25), createdAt: ts(2026, 10, 25),
      condonacion: { condonadaPor: BA, createdAt: ts(2026, 10, 28), motivo: null },
    }],
    ["reintegros", "r5", {
      registradoPor: BA, participantes: [BA, BB], sentido: "por_cobrar",
      monto: 1500, devuelto: 0, movimientoInicial: "salida",
      fecha: ts(2026, 10, 10), createdAt: ts(2026, 10, 10),
      condonacion: { condonadaPor: BA, createdAt: ts(2026, 10, 29), motivo: null },
    }],
    ["reintegros", "r6", {
      registradoPor: BA, participantes: [BA, BB], sentido: "por_devolver",
      monto: 2500, devuelto: 1000, movimientoInicial: "ninguno",
      fecha: ts(2026, 10, 12), createdAt: ts(2026, 10, 12),
    }],
    ["reintegros", "r7", {
      registradoPor: BA, participantes: [BA, BB], sentido: "por_cobrar",
      monto: 1200, devuelto: 1200, movimientoInicial: "ninguno",
      fecha: ts(2026, 10, 18), createdAt: ts(2026, 10, 18),
    }],
  );

  docs.push(
    ["reintegro_devoluciones", "d1", {
      reintegroId: "r1", monto: 1000, fechaPago: ts(2026, 10, 20),
      realizadoPorUid: BB, registradoPor: BB,
    }],
    ["reintegro_devoluciones", "d2", {
      reintegroId: "r1", monto: 500, fechaPago: ts(2026, 11, 5),
      realizadoPorUid: BB, registradoPor: BB,
    }],
    ["reintegro_devoluciones", "d3", {
      reintegroId: "r7", monto: 1200, fechaPago: ts(2026, 10, 22),
      realizadoPorUid: BB, registradoPor: BB,
    }],
    ["reintegro_devoluciones", "d4", {
      reintegroId: "r6", monto: 1000, fechaPago: ts(2026, 10, 24),
      realizadoPorUid: BA, registradoPor: BA,
    }],
  );

  // ── HB04: legacy (sin fecha / sin moneda / sin devuelto) ──────────────
  docs.push(
    ["gastos", "b4g", { usuario: B4, tipo: "personal", monto: 1000, createdAt: ts(2026, 10, 20) }],
    ["ingresos", "b4i", { usuario: B4, tipo: "otros", monto: 2000, createdAt: ts(2026, 10, 21) }],
    ["reintegros", "b4r", {
      registradoPor: B4, participantes: [B4], sentido: "por_cobrar",
      monto: 1500, movimientoInicial: "salida",
      createdAt: ts(2026, 10, 15),
    }],
  );

  // ── HB05: dos grupos ───────────────────────────────────────────────────
  docs.push(
    ["groups", "bg5a", { name: "Grupo 5 A", members: [B5A, B5B] }],
    ["groups", "bg5b", { name: "Grupo 5 B", members: [B5A, B5B] }],
    ["gastos", "g5p", { usuario: B5A, tipo: "personal", monto: 100, fecha: ts(2026, 10, 5), createdAt: ts(2026, 10, 5) }],
    ["gastos", "g5a", { usuario: B5A, tipo: "compartido", groupId: "bg5a", monto: 700, fecha: ts(2026, 10, 6), createdAt: ts(2026, 10, 6) }],
    ["gastos", "g5b", { usuario: B5A, tipo: "compartido", groupId: "bg5b", monto: 300, fecha: ts(2026, 10, 7), createdAt: ts(2026, 10, 7) }],
    ["gastos", "g5c", { usuario: B5B, tipo: "compartido", groupId: "bg5b", monto: 900, fecha: ts(2026, 10, 8), createdAt: ts(2026, 10, 8) }],
    ["fixed_expense_entries", "e5a", { usuario: B5A, groupId: "bg5a", periodo: "2026-10", montoTotal: 400, paidByUid: B5A }],
    ["fixed_expense_entries", "e5b", { usuario: B5B, groupId: "bg5b", periodo: "2026-10", montoTotal: 1000, paidByUid: B5B }],
  );

  // ── HB07: grupo del que A NO es miembro ────────────────────────────────
  docs.push(
    ["groups", BG7, { name: "Grupo ajeno", members: [B7B] }],
    ["fixed_expense_entries", "e7", { usuario: B7B, groupId: BG7, periodo: "2026-10", montoTotal: 100, paidByUid: B7B }],
  );

  // ── HB09: 12 obligaciones (2 tandas de entregas) ───────────────────────
  for (let i = 0; i < 12; i += 1) {
    docs.push([
      "reintegros",
      `r9_${i}`,
      {
        registradoPor: B9A, participantes: [B9A, B9B], sentido: "por_cobrar",
        monto: 1000, devuelto: 100, movimientoInicial: "ninguno",
        fecha: ts(2026, 10, 1), createdAt: ts(2026, 10, 1),
      },
    ]);
    docs.push([
      "reintegro_devoluciones",
      `d9_${i}`,
      {
        reintegroId: `r9_${i}`, monto: 100, fechaPago: ts(2026, 10, 15),
        realizadoPorUid: B9B, registradoPor: B9B,
      },
    ]);
  }

  return docs;
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-finanzas",
    firestore: { rules: rulesSrc },
  });
  await seedDocumentos(documentos());
});

after(async () => {
  await testEnv.cleanup();
});

// ═══ HB01 — fixture completo de octubre ═══════════════════════════════════

test("HB01 — fixture de octubre: cada componente del contrato", async () => {
  const balance = await balanceDelMes({
    db: dbAs(BA),
    uid: BA,
    mes: "2026-10",
    groups: [{ id: BG }],
    ahora: AHORA,
    inversiones: -1500,
  });

  assert.equal(balance.mes, "2026-10");
  assert.deepEqual(balance.rango, {
    desde: new Date(2026, 9, 1),
    hasta: new Date(2026, 10, 1),
  });
  assert.deepEqual(balance.ingresos, { uyu: 21000, usd: 800 });
  assert.deepEqual(balance.egresos, {
    total: 10800,
    diarios: 5000,
    compartidosDiarios: 2000,
    fijosPersonales: 1500,
    fijosCompartidos: 2300,
  });
  assert.equal(balance.resultado, 10200);
  assert.deepEqual(balance.reintegros, {
    entradas: 5200,
    salidas: 5500,
    neto: -300,
  });
  assert.equal(balance.inversiones, -1500);
  assert.deepEqual(balance.condonaciones, { ganadas: 3000, perdidas: 3500 });
  assert.equal(balance.movimientoEsperado, 8400);
  assert.deepEqual(balance.stock, {
    pendienteCobro: 2000,
    pendienteDevolucion: 1500,
    corte: CORTE_OCTUBRE,
  });

  assert.ok(!("observado" in balance));
  assert.ok(!("diferencia" in balance));
  assert.ok(!("cajaEsperada" in balance));
});

// ═══ HB02 — stock al corte + pago del mes siguiente ═══════════════════════

test("HB02 — el pago de noviembre no altera el cierre de octubre", async () => {
  const db = dbAs(BA);

  const octubre = await balanceDelMes({
    db, uid: BA, mes: "2026-10", groups: [{ id: BG }], ahora: AHORA,
  });
  const noviembre = await balanceDelMes({
    db, uid: BA, mes: "2026-11", groups: [{ id: BG }], ahora: AHORA,
  });

  assert.deepEqual(octubre.stock, {
    pendienteCobro: 2000,
    pendienteDevolucion: 1500,
    corte: CORTE_OCTUBRE,
  });
  assert.equal(octubre.reintegros.entradas, 5200);

  assert.equal(noviembre.reintegros.entradas, 500);
  assert.equal(noviembre.reintegros.salidas, 0);
  assert.deepEqual(noviembre.stock, {
    pendienteCobro: 1500,
    pendienteDevolucion: 1500,
    corte: new Date(2026, 10, 30, 23, 59, 59, 999),
  });
});

// ═══ HB03 — condonaciones: memo + stock, sin movimiento ═══════════════════

test("HB03 — condonaciones ganada y perdida: memo en su mes, fuera del stock", async () => {
  const db = dbAs(BA);

  const octubre = await balanceDelMes({
    db, uid: BA, mes: "2026-10", groups: [{ id: BG }], ahora: AHORA,
  });
  const noviembre = await balanceDelMes({
    db, uid: BA, mes: "2026-11", groups: [{ id: BG }], ahora: AHORA,
  });

  assert.deepEqual(octubre.condonaciones, { ganadas: 3000, perdidas: 3500 });
  assert.equal(octubre.stock.pendienteCobro, 2000);
  assert.equal(octubre.stock.pendienteDevolucion, 1500);

  assert.deepEqual(noviembre.condonaciones, { ganadas: 0, perdidas: 0 });
});

// ═══ HB04 — legacy en colecciones reales ══════════════════════════════════

test("HB04 — legacy: sin fecha, sin moneda y sin devuelto se leen con fallback", async () => {
  const balance = await balanceDelMes({
    db: dbAs(B4), uid: B4, mes: "2026-10", ahora: AHORA,
  });

  assert.equal(balance.egresos.diarios, 1000);
  assert.equal(balance.ingresos.uyu, 2000);
  assert.equal(balance.ingresos.usd, 0);
  assert.deepEqual(balance.reintegros, {
    entradas: 0,
    salidas: 1500,
    neto: -1500,
  });
  assert.equal(balance.stock.pendienteCobro, 1500);
  assert.equal(balance.resultado, 1000);
  assert.equal(balance.movimientoEsperado, -500);
});

// ═══ HB05 — dos grupos: se consultan ambos ════════════════════════════════

test("HB05 — el adaptador consulta todos los grupos recibidos", async () => {
  const db = dbAs(B5A);

  const ambos = await balanceDelMes({
    db, uid: B5A, mes: "2026-10",
    groups: [{ id: "bg5a" }, { id: "bg5b" }], ahora: AHORA,
  });

  assert.equal(ambos.egresos.diarios, 100);
  assert.equal(ambos.egresos.compartidosDiarios, 1000);
  assert.equal(ambos.egresos.fijosCompartidos, 700);
  assert.equal(ambos.egresos.total, 1800);

  const soloA = await balanceDelMes({
    db, uid: B5A, mes: "2026-10", groups: [{ id: "bg5a" }], ahora: AHORA,
  });

  assert.equal(soloA.egresos.compartidosDiarios, 700);
  assert.equal(soloA.egresos.fijosCompartidos, 200);
  assert.equal(soloA.egresos.total, 1000);
});

// ═══ HB06 — mes vacío y sin grupos ════════════════════════════════════════

test("HB06 — usuario sin datos y sin grupos: ceros, sin error", async () => {
  const db = dbAs(B6);

  const sinGrupos = await balanceDelMes({ db, uid: B6, mes: "2026-10", ahora: AHORA });
  const conListaVacia = await balanceDelMes({
    db, uid: B6, mes: "2026-10", groups: [], ahora: AHORA,
  });

  for (const balance of [sinGrupos, conListaVacia]) {
    assert.equal(balance.ingresos.uyu, 0);
    assert.equal(balance.egresos.total, 0);
    assert.equal(balance.resultado, 0);
    assert.equal(balance.movimientoEsperado, 0);
    assert.deepEqual(balance.stock, {
      pendienteCobro: 0,
      pendienteDevolucion: 0,
      corte: CORTE_OCTUBRE,
    });
  }
});

// ═══ HB07 — error tipado de lectura ═══════════════════════════════════════

test("HB07 — grupo ajeno ⇒ LECTURA_FALLIDA, sin objeto parcial", async () => {
  await assert.rejects(
    balanceDelMes({
      db: dbAs(B7A), uid: B7A, mes: "2026-10",
      groups: [{ id: BG7 }], ahora: AHORA,
    }),
    (error) => {
      assert.equal(error.name, "BalanceError");
      assert.equal(error.codigo, "LECTURA_FALLIDA");
      assert.ok(error.causa, "conserva el error original en `causa`");

      return true;
    },
  );
});

// ═══ HB08 — una lectura para N meses ══════════════════════════════════════

test("HB08 — cargar una vez y calcular N meses == balanceDelMes por mes", async () => {
  const db = dbAs(BA);
  const datos = await cargarDatosBalance({
    db, uid: BA, groups: [{ id: BG }],
  });

  const octubre = calcularBalanceDelMes({
    mes: "2026-10", uid: BA, datos, ahora: AHORA, inversiones: -1500,
  });
  const noviembre = calcularBalanceDelMes({
    mes: "2026-11", uid: BA, datos, ahora: AHORA,
  });

  const octubreAdaptador = await balanceDelMes({
    db, uid: BA, mes: "2026-10", groups: [{ id: BG }], ahora: AHORA,
    inversiones: -1500,
  });
  const noviembreAdaptador = await balanceDelMes({
    db, uid: BA, mes: "2026-11", groups: [{ id: BG }], ahora: AHORA,
  });

  assert.deepEqual(octubre, octubreAdaptador);
  assert.deepEqual(noviembre, noviembreAdaptador);
  assert.ok(!("inversiones" in datos));
});

// ═══ HB09 — entregas en tandas de 10 ══════════════════════════════════════

test("HB09 — 12 obligaciones con pago: se leen las 2 tandas", async () => {
  const balance = await balanceDelMes({
    db: dbAs(B9A), uid: B9A, mes: "2026-10", ahora: AHORA,
  });

  assert.equal(balance.reintegros.entradas, 1200);
  assert.equal(balance.stock.pendienteCobro, 10800);
  assert.equal(balance.stock.pendienteDevolucion, 0);
});

// ═══ HB10 — paridad con el stock actual de modelo.js ══════════════════════

test("HB10 — el stock del mes en curso coincide con la derivación de modelo.js", async () => {
  const db = dbAs(BA);
  const datos = await cargarDatosBalance({
    db, uid: BA, groups: [{ id: BG }],
  });

  const activas = datos.obligaciones.filter(
    (obligacion) => !("eliminacion" in obligacion),
  );

  function pendiente(sentido) {
    return activas
      .filter(
        (obligacion) =>
          !("condonacion" in obligacion) &&
          sentidoDelViewer(obligacion, BA) === sentido &&
          saldoDe(obligacion) > 0,
      )
      .reduce((acc, obligacion) => acc + saldoDe(obligacion), 0);
  }

  const balance = await balanceDelMes({
    db, uid: BA, mes: "2026-12", groups: [{ id: BG }], ahora: AHORA,
  });

  assert.equal(balance.stock.pendienteCobro, pendiente("por_cobrar"));
  assert.equal(balance.stock.pendienteDevolucion, pendiente("por_devolver"));
  assert.equal(balance.stock.pendienteCobro, 1500);
  assert.equal(balance.stock.pendienteDevolucion, 1500);
});

// ═══ HB11 — inversiones: input, no lectura ════════════════════════════════

test("HB11 — inversiones mueve solo el movimiento (aporte/rescate/ausente)", async () => {
  const db = dbAs(BA);
  const datos = await cargarDatosBalance({
    db, uid: BA, groups: [{ id: BG }],
  });

  assert.ok(!("inversiones" in datos));

  const base = {
    db, uid: BA, mes: "2026-10", groups: [{ id: BG }], ahora: AHORA,
  };
  const sin = await balanceDelMes(base);
  const neto = await balanceDelMes({ ...base, inversiones: -1500 });
  const rescate = await balanceDelMes({ ...base, inversiones: 500 });

  assert.equal(sin.inversiones, 0);
  assert.equal(sin.movimientoEsperado, sin.resultado + sin.reintegros.neto);

  assert.equal(neto.inversiones, -1500);
  assert.equal(neto.movimientoEsperado, sin.movimientoEsperado - 1500);
  assert.equal(rescate.movimientoEsperado, sin.movimientoEsperado + 500);

  for (const balance of [neto, rescate]) {
    assert.equal(balance.resultado, sin.resultado);
    assert.deepEqual(balance.ingresos, sin.ingresos);
    assert.deepEqual(balance.egresos, sin.egresos);
    assert.deepEqual(balance.stock, sin.stock);
  }
});
