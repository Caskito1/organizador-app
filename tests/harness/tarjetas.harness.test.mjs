// tests/harness/tarjetas.harness.test.mjs
// 6.1 — persistencia de tarjetas en users/{uid}.tarjetas contra el emulador
// demo-finanzas y las reglas reales (PROPUESTA-ETAPA-6.md §11.8).
//
// Cubre: lectura sin perfil, upsert que preserva el doc, validaciones que no
// escriben, compras (array), pagos por moneda, apertura (array), estados,
// PERFIL_FALTANTE, aislamiento entre uids, bimoneda y la integración con el
// modelo puro de 6.0 (§8.1).

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

import {
  leerTarjetas,
  guardarTarjeta,
  eliminarTarjeta,
  agregarCompra,
  editarCompra,
  eliminarCompra,
  guardarPago,
  eliminarPago,
  agregarApertura,
  editarApertura,
  eliminarApertura,
  guardarEstadoCiclo,
} from "../../app/tarjetas/services/tarjetas.js";
import { desgloseCiclo } from "../../app/tarjetas/helpers/deuda.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rulesSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "firestore.rules"),
  "utf8",
);

const A = "uid_tj_a";
const B = "uid_tj_b";
const MISSING = "uid_tj_missing";
const OCA = { nombre: "OCA", diaCierre: 18, diaVencimiento: 30 };

let testEnv = null;

function dbAs(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

async function leerDoc(uid = A) {
  const snap = await getDoc(doc(dbAs(uid), "users", uid));
  return snap.exists() ? snap.data() : null;
}

async function rechaza(promesa, codigo) {
  await assert.rejects(promesa, (error) => error?.codigo === codigo);
}

function fecha(anio, mes1, dia) {
  return new Date(anio, mes1 - 1, dia);
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-finanzas",
    firestore: { rules: rulesSrc },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    await setDoc(doc(db, "users", A), {
      uid: A,
      displayName: "Alice",
      email: "alice@example.com",
      balances: { meses: { "2026-10": { cajaRealAlCierre: 12000 } } },
    });
    await setDoc(doc(db, "users", B), {
      uid: B,
      displayName: "Bob",
    });
  });
});

after(async () => {
  await testEnv.cleanup();
});

test("HT01 — leerTarjetas sin users/{uid} → { existe:false, tarjetas:{} }", async () => {
  const r = await leerTarjetas({ db: dbAs(MISSING), uid: MISSING });
  assert.deepEqual(r, { existe: false, tarjetas: {} });
});

test("HT02 — guardarTarjeta crea y preserva el resto del doc", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });

  const data = await leerDoc();
  assert.equal(data.uid, A);
  assert.equal(data.displayName, "Alice");
  assert.equal(data.email, "alice@example.com");
  assert.equal(data.balances.meses["2026-10"].cajaRealAlCierre, 12000);
  assert.equal(data.tarjetas.oca.nombre, "OCA");
  assert.equal(data.tarjetas.oca.diaCierre, 18);
  assert.deepEqual(data.tarjetas.oca.compras, []);
});

test("HT03 — upsert actualiza config sin borrar compras/pagos", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });
  const { compraId } = await agregarCompra({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    compra: { fecha: fecha(2026, 10, 10), detalle: "Heladera", monto: 108000, moneda: "UYU", cuotasTotal: 6 },
  });
  await guardarPago({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    cicloKey: "2026-12",
    moneda: "UYU",
    pago: { monto: 86000, fecha: fecha(2026, 12, 30) },
  });

  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: { ...OCA, nombre: "OCA Visa" } });

  const data = await leerDoc();
  assert.equal(data.tarjetas.oca.nombre, "OCA Visa");
  assert.deepEqual(data.tarjetas.oca.compras.map((c) => c.id), [compraId]);
  assert.equal(data.tarjetas.oca.pagos["2026-12"].UYU.monto, 86000);
});

test("HT04 — config inválida → TARJETA_INVALIDA y no escribe", async () => {
  await rechaza(
    guardarTarjeta({
      db: dbAs(A),
      uid: A,
      tarjetaId: "oca",
      config: { ...OCA, diaCierre: 29 },
    }),
    "TARJETA_INVALIDA",
  );
  await rechaza(
    guardarTarjeta({
      db: dbAs(A),
      uid: A,
      tarjetaId: "oca",
      config: { ...OCA, nombre: "" },
    }),
    "TARJETA_INVALIDA",
  );

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca, undefined);
});

test("HT05 — agregarCompra agrega al array con id y createdAt", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });

  const { compraId, compra } = await agregarCompra({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    compra: { fecha: fecha(2026, 10, 10), detalle: "Heladera", monto: 108000, moneda: "UYU", cuotasTotal: 6 },
  });

  assert.equal(typeof compraId, "string");
  assert.ok(compraId.length > 0);

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.compras.length, 1);
  assert.equal(r.tarjetas.oca.compras[0].id, compraId);
  assert.equal(r.tarjetas.oca.compras[0].monto, 108000);
  assert.ok(r.tarjetas.oca.compras[0].createdAt);
});

test("HT06 — editarCompra cambia solo la indicada", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });

  const { compraId: c1 } = await agregarCompra({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    compra: { fecha: fecha(2026, 10, 5), detalle: "Uno", monto: 1000, moneda: "UYU" },
  });
  const { compraId: c2 } = await agregarCompra({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    compra: { fecha: fecha(2026, 10, 6), detalle: "Dos", monto: 2000, moneda: "UYU" },
  });

  await editarCompra({ db: dbAs(A), uid: A, tarjetaId: "oca", compraId: c1, cambios: { monto: 1500 } });

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  const porId = Object.fromEntries(r.tarjetas.oca.compras.map((c) => [c.id, c]));
  assert.equal(porId[c1].monto, 1500);
  assert.equal(porId[c2].monto, 2000);
});

test("HT07 — eliminarCompra quita solo esa (array reescrito)", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });

  const { compraId: c1 } = await agregarCompra({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    compra: { fecha: fecha(2026, 10, 5), detalle: "Uno", monto: 1000, moneda: "UYU" },
  });
  const { compraId: c2 } = await agregarCompra({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    compra: { fecha: fecha(2026, 10, 6), detalle: "Dos", monto: 2000, moneda: "UYU" },
  });

  const eliminada = await eliminarCompra({ db: dbAs(A), uid: A, tarjetaId: "oca", compraId: c1 });
  assert.equal(eliminada.compra.id, c1);

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.deepEqual(r.tarjetas.oca.compras.map((c) => c.id), [c2]);
});

test("HT08 — pagos por moneda y borrado (ciclo vacío desaparece)", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });

  await guardarPago({ db: dbAs(A), uid: A, tarjetaId: "oca", cicloKey: "2026-12", moneda: "UYU", pago: { monto: 86000, fecha: fecha(2026, 12, 30) } });
  await guardarPago({ db: dbAs(A), uid: A, tarjetaId: "oca", cicloKey: "2026-12", moneda: "USD", pago: { monto: 500, fecha: fecha(2026, 12, 30) } });

  let r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.pagos["2026-12"].UYU.monto, 86000);
  assert.equal(r.tarjetas.oca.pagos["2026-12"].USD.monto, 500);

  await eliminarPago({ db: dbAs(A), uid: A, tarjetaId: "oca", cicloKey: "2026-12", moneda: "UYU" });
  r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.deepEqual(Object.keys(r.tarjetas.oca.pagos["2026-12"]), ["USD"]);

  await eliminarPago({ db: dbAs(A), uid: A, tarjetaId: "oca", cicloKey: "2026-12", moneda: "USD" });
  r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.pagos["2026-12"], undefined, "el ciclo vacío se borra");
});

test("HT09 — pago inválido → PAGO_INVALIDO y no escribe", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });

  await rechaza(
    guardarPago({ db: dbAs(A), uid: A, tarjetaId: "oca", cicloKey: "2026-12", moneda: "UYU", pago: { monto: 1.5, fecha: fecha(2026, 12, 30) } }),
    "PAGO_INVALIDO",
  );
  await rechaza(
    guardarPago({ db: dbAs(A), uid: A, tarjetaId: "oca", cicloKey: "2026-12", moneda: "EUR", pago: { monto: 100, fecha: fecha(2026, 12, 30) } }),
    "PAGO_INVALIDO",
  );

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.deepEqual(r.tarjetas.oca.pagos, {});
});

test("HT10 — apertura: alta, edición y baja por id", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });

  const { planId } = await agregarApertura({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    plan: { descripcion: "opencodeGo", moneda: "UYU", montoCuota: 5000, cuotasTotal: 12, desdeCiclo: "2026-10" },
  });

  await editarApertura({ db: dbAs(A), uid: A, tarjetaId: "oca", planId, cambios: { montoCuota: 6000 } });
  let r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.apertura[0].montoCuota, 6000);

  await eliminarApertura({ db: dbAs(A), uid: A, tarjetaId: "oca", planId });
  r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.deepEqual(r.tarjetas.oca.apertura, []);
});

test("HT11 — estado del ciclo: set y reset (borrado)", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });

  await guardarEstadoCiclo({ db: dbAs(A), uid: A, tarjetaId: "oca", cicloKey: "2026-12", estado: "por_pagar" });
  let r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.ciclos["2026-12"].estado, "por_pagar");

  await guardarEstadoCiclo({ db: dbAs(A), uid: A, tarjetaId: "oca", cicloKey: "2026-12", estado: "sin_verificar" });
  r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.ciclos["2026-12"], undefined, "sin_verificar borra el estado");

  await rechaza(
    guardarEstadoCiclo({ db: dbAs(A), uid: A, tarjetaId: "oca", cicloKey: "2026-12", estado: "raro" }),
    "CICLO_INVALIDO",
  );
});

test("HT12 — sin users/{uid} → PERFIL_FALTANTE y no crea el doc", async () => {
  await rechaza(
    guardarTarjeta({ db: dbAs(MISSING), uid: MISSING, tarjetaId: "oca", config: OCA }),
    "PERFIL_FALTANTE",
  );

  const snap = await getDoc(doc(dbAs(MISSING), "users", MISSING));
  assert.equal(snap.exists(), false);
});

test("HT13 — un uid no puede escribir el doc de otro", async () => {
  await rechaza(
    guardarTarjeta({ db: dbAs(B), uid: A, tarjetaId: "oca", config: OCA }),
    "ESCRITURA_FALLIDA",
  );

  const data = await leerDoc();
  assert.equal(data.tarjetas, undefined);
});

test("HT14 — bimoneda: compras y pagos UYU/USD conviven", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });

  await agregarCompra({ db: dbAs(A), uid: A, tarjetaId: "oca", compra: { fecha: fecha(2026, 10, 5), detalle: "Pesos", monto: 10000, moneda: "UYU" } });
  await agregarCompra({ db: dbAs(A), uid: A, tarjetaId: "oca", compra: { fecha: fecha(2026, 10, 6), detalle: "Dólares", monto: 500, moneda: "USD" } });
  await guardarPago({ db: dbAs(A), uid: A, tarjetaId: "oca", cicloKey: "2026-10", moneda: "UYU", pago: { monto: 10000, fecha: fecha(2026, 10, 30) } });
  await guardarPago({ db: dbAs(A), uid: A, tarjetaId: "oca", cicloKey: "2026-10", moneda: "USD", pago: { monto: 500, fecha: fecha(2026, 10, 30) } });

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.deepEqual(r.tarjetas.oca.compras.map((c) => c.moneda).sort(), ["USD", "UYU"]);
  assert.equal(r.tarjetas.oca.pagos["2026-10"].UYU.monto, 10000);
  assert.equal(r.tarjetas.oca.pagos["2026-10"].USD.monto, 500);
});

test("HT15 — lectura + modelo puro reproducen §8.1", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });

  await agregarCompra({ db: dbAs(A), uid: A, tarjetaId: "oca", compra: { fecha: fecha(2026, 10, 5), detalle: "Zapatillas", monto: 12000, moneda: "UYU", cuotasTotal: 1 } });
  await agregarCompra({ db: dbAs(A), uid: A, tarjetaId: "oca", compra: { fecha: fecha(2026, 10, 10), detalle: "Heladera", monto: 108000, moneda: "UYU", cuotasTotal: 6 } });
  await agregarCompra({ db: dbAs(A), uid: A, tarjetaId: "oca", compra: { fecha: fecha(2026, 10, 12), detalle: "Pasajes", monto: 56000, moneda: "UYU", cuotasTotal: 1, tipo: "reintegro" } });

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  const desglose = desgloseCiclo({
    compras: r.tarjetas.oca.compras,
    apertura: r.tarjetas.oca.apertura,
    cicloKey: "2026-10",
    diaCierre: 18,
    diaVencimiento: 30,
  });

  assert.deepEqual(desglose.personales, { UYU: 30000, USD: 0 });
  assert.deepEqual(desglose.reintegros, { UYU: 56000, USD: 0 });
  assert.deepEqual(desglose.total, { UYU: 86000, USD: 0 });
  assert.deepEqual(desglose.deudaPorVencer, { UYU: 90000, USD: 0 });
});

test("HT16 — eliminarTarjeta la borra del mapa (y conserva las demás)", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "visa", config: { ...OCA, nombre: "Visa" } });

  const r = await eliminarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca" });
  assert.equal(r.tarjeta.nombre, "OCA");

  const data = await leerDoc();
  assert.equal(data.tarjetas.oca, undefined);
  assert.equal(data.tarjetas.visa.nombre, "Visa");
});
