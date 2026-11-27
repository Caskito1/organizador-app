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
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, Timestamp } from "firebase/firestore";

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
import {
  crearCompraConReintegro,
  editarCompraVinculada,
  eliminarCompraVinculada,
  leerVinculos,
  recrearReintegro,
} from "../../app/tarjetas/services/reintegroDeCompra.js";
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
    ahora: fecha(2026, 10, 15),
    compra: { fecha: fecha(2026, 10, 10), detalle: "Heladera", monto: 108000, moneda: "UYU", cuotasTotal: 6 },
  });
  await guardarPago({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    ahora: fecha(2026, 10, 15),
    cicloKey: "2026-12",
    moneda: "UYU",
    pago: { monto: 86000, fecha: fecha(2026, 12, 30) },
  });

  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", ahora: fecha(2026, 10, 15), config: { ...OCA, nombre: "OCA Visa" } });

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
    ahora: fecha(2026, 10, 15),
    plan: { descripcion: "opencodeGo", moneda: "UYU", montoCuota: 5000, cuotasTotal: 12, desdeCiclo: "2026-10" },
  });

  await editarApertura({ db: dbAs(A), uid: A, tarjetaId: "oca", planId, ahora: fecha(2026, 10, 15), cambios: { montoCuota: 6000 } });
  let r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.apertura[0].montoCuota, 6000);

  await eliminarApertura({ db: dbAs(A), uid: A, tarjetaId: "oca", planId, ahora: fecha(2026, 10, 15) });
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

  await agregarCompra({ db: dbAs(A), uid: A, tarjetaId: "oca", ahora: fecha(2026, 10, 15), compra: { fecha: fecha(2026, 10, 5), detalle: "Zapatillas", monto: 12000, moneda: "UYU", cuotasTotal: 1 } });
  await agregarCompra({ db: dbAs(A), uid: A, tarjetaId: "oca", ahora: fecha(2026, 10, 15), compra: { fecha: fecha(2026, 10, 10), detalle: "Heladera", monto: 108000, moneda: "UYU", cuotasTotal: 6 } });
  await agregarCompra({ db: dbAs(A), uid: A, tarjetaId: "oca", ahora: fecha(2026, 10, 15), compra: { fecha: fecha(2026, 10, 12), detalle: "Pasajes", monto: 56000, moneda: "UYU", cuotasTotal: 1, tipo: "reintegro" } });

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

// ── 6.2-bis — factura pendiente ───────────────────────────────────────────

test("HTB1 — pendiente bloquea compras, config, pagos posteriores y borrado", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });
  await agregarCompra({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    ahora: fecha(2026, 10, 15),
    compra: { fecha: fecha(2026, 10, 10), detalle: "Pendiente", monto: 10000, moneda: "UYU" },
  });
  await guardarEstadoCiclo({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    ahora: fecha(2026, 10, 15),
    cicloKey: "2026-10",
    estado: "por_pagar",
  });

  // Ahora (diciembre): 2026-10 es pendiente.
  await rechaza(
    agregarCompra({
      db: dbAs(A),
      uid: A,
      tarjetaId: "oca",
      compra: { fecha: fecha(2026, 12, 10), detalle: "Bloqueada", monto: 5000, moneda: "UYU" },
    }),
    "CICLO_BLOQUEADO",
  );
  await rechaza(
    guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: { ...OCA, nombre: "Otra" } }),
    "CICLO_BLOQUEADO",
  );
  await rechaza(
    guardarPago({
      db: dbAs(A),
      uid: A,
      tarjetaId: "oca",
      cicloKey: "2026-11",
      moneda: "UYU",
      pago: { monto: 1000, fecha: fecha(2026, 11, 30) },
    }),
    "CICLO_BLOQUEADO",
  );
  await rechaza(
    guardarPago({
      db: dbAs(A),
      uid: A,
      tarjetaId: "oca",
      cicloKey: "2026-12",
      moneda: "UYU",
      pago: { monto: 1000, fecha: fecha(2026, 12, 30) },
    }),
    "CICLO_BLOQUEADO",
  );
  await rechaza(
    eliminarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca" }),
    "CICLO_BLOQUEADO",
  );
  // Integración 6.3: el alta de compra con reintegro también queda bloqueada.
  await rechaza(
    crearCompraConReintegro({
      db: dbAs(A),
      uid: A,
      uidNombre: "Alice",
      tarjetaId: "oca",
      compra: {
        fecha: fecha(2026, 12, 10),
        detalle: "Reintegro bloqueado",
        monto: 5000,
        moneda: "UYU",
        tipo: "reintegro",
      },
      contraparteNombre: "Bruno",
    }),
    "CICLO_BLOQUEADO",
  );

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.compras.length, 1);
  assert.equal(r.tarjetas.oca.nombre, "OCA");
  assert.deepEqual(r.tarjetas.oca.pagos, {});
});

test("HTB2 — pagar el pendiente desbloquea los ciclos posteriores", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });
  await agregarCompra({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    ahora: fecha(2026, 10, 15),
    compra: { fecha: fecha(2026, 10, 10), detalle: "Octubre", monto: 10000, moneda: "UYU" },
  });
  await guardarEstadoCiclo({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    ahora: fecha(2026, 10, 15),
    cicloKey: "2026-10",
    estado: "por_pagar",
  });

  await guardarPago({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    cicloKey: "2026-10",
    moneda: "UYU",
    pago: { monto: 10000, fecha: fecha(2026, 10, 30) },
  });
  await guardarEstadoCiclo({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    cicloKey: "2026-10",
    estado: "pagada",
  });

  await agregarCompra({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    compra: { fecha: fecha(2026, 12, 10), detalle: "Diciembre", monto: 3000, moneda: "UYU" },
  });

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.compras.length, 2);
  assert.equal(r.tarjetas.oca.ciclos["2026-10"].estado, "pagada");
});

test("HTB3 — un pendiente sin_verificar se puede cerrar y luego pagar", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });
  await agregarCompra({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    ahora: fecha(2026, 10, 15),
    compra: { fecha: fecha(2026, 10, 10), detalle: "Sin cerrar", monto: 7000, moneda: "UYU" },
  });

  // Con el ciclo actual en diciembre, 2026-10 queda pendiente sin verificar.
  await guardarEstadoCiclo({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    cicloKey: "2026-10",
    estado: "por_pagar",
  });

  let r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.ciclos["2026-10"].estado, "por_pagar");

  await guardarPago({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    cicloKey: "2026-10",
    moneda: "UYU",
    pago: { monto: 7000, fecha: fecha(2026, 10, 30) },
  });
  await guardarEstadoCiclo({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    cicloKey: "2026-10",
    estado: "pagada",
  });

  r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.ciclos["2026-10"].estado, "pagada");
});

test("HTB4 — un ciclo pasado SIN datos no bloquea (no es pendiente)", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });
  await guardarEstadoCiclo({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    cicloKey: "2026-09",
    estado: "por_pagar",
  });

  await agregarCompra({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    compra: { fecha: fecha(2026, 12, 10), detalle: "Actual", monto: 3000, moneda: "UYU" },
  });

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.compras.length, 1);
});

test("HTB5 — dos pendientes: se resuelven del más viejo al más nuevo", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });
  await agregarCompra({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    ahora: fecha(2026, 10, 15),
    compra: { fecha: fecha(2026, 10, 10), detalle: "Octubre", monto: 10000, moneda: "UYU" },
  });
  await agregarCompra({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    ahora: fecha(2026, 10, 15),
    compra: { fecha: fecha(2026, 11, 10), detalle: "Noviembre", monto: 20000, moneda: "UYU" },
  });

  // Con diciembre como actual hay dos pendientes (oct y nov).
  await rechaza(
    guardarPago({
      db: dbAs(A),
      uid: A,
      tarjetaId: "oca",
      cicloKey: "2026-11",
      moneda: "UYU",
      pago: { monto: 20000, fecha: fecha(2026, 11, 30) },
    }),
    "CICLO_BLOQUEADO",
  );

  await guardarPago({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    cicloKey: "2026-10",
    moneda: "UYU",
    pago: { monto: 10000, fecha: fecha(2026, 10, 30) },
  });
  await guardarEstadoCiclo({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    cicloKey: "2026-10",
    estado: "pagada",
  });

  // Noviembre pasa a ser el pendiente: se puede pagar.
  await guardarPago({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    cicloKey: "2026-11",
    moneda: "UYU",
    pago: { monto: 20000, fecha: fecha(2026, 11, 30) },
  });
  await guardarEstadoCiclo({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    cicloKey: "2026-11",
    estado: "pagada",
  });

  await agregarCompra({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    compra: { fecha: fecha(2026, 12, 10), detalle: "Diciembre", monto: 3000, moneda: "UYU" },
  });

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.compras.length, 3);
});

test("HTB6 — editar/eliminar una compra que toca ciclos posteriores se bloquea", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });
  const { compraId } = await agregarCompra({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    ahora: fecha(2026, 9, 15),
    compra: { fecha: fecha(2026, 9, 10), detalle: "En cuotas", monto: 30000, moneda: "UYU", cuotasTotal: 3 },
  });
  await guardarEstadoCiclo({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    ahora: fecha(2026, 9, 15),
    cicloKey: "2026-09",
    estado: "pagada",
  });

  // Con diciembre como actual, 2026-10 es el pendiente y la compra toca 11.
  await rechaza(
    editarCompra({ db: dbAs(A), uid: A, tarjetaId: "oca", compraId, cambios: { monto: 20000 } }),
    "CICLO_BLOQUEADO",
  );
  await rechaza(
    eliminarCompra({ db: dbAs(A), uid: A, tarjetaId: "oca", compraId }),
    "CICLO_BLOQUEADO",
  );

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.compras.length, 1);
  assert.equal(r.tarjetas.oca.compras[0].monto, 30000);
});

// ── 6.3 — compra «Reintegro» ↔ obligación ────────────────────────────────

const REINTEGRO_BASE = {
  fecha: fecha(2026, 10, 10),
  detalle: "Pasajes",
  monto: 56000,
  moneda: "UYU",
  cuotasTotal: 1,
  tipo: "reintegro",
};

async function altaReintegro(over = {}) {
  return crearCompraConReintegro({
    db: dbAs(A),
    uid: A,
    uidNombre: "Alice",
    tarjetaId: "oca",
    ahora: fecha(2026, 10, 15),
    compra: { ...REINTEGRO_BASE, ...over.compra },
    contraparteNombre: over.contraparteNombre ?? "Bruno",
    compraId: over.compraId,
    rid: over.rid,
  });
}

test("HT17 — alta de compra reintegro: compra + obligación + evento atómicos", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });

  const { compraId, rid, compra } = await altaReintegro();

  assert.equal(typeof compraId, "string");
  assert.equal(compra.gastoVinculadoId, rid);

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.compras.length, 1);
  assert.equal(r.tarjetas.oca.compras[0].tipo, "reintegro");
  assert.equal(r.tarjetas.oca.compras[0].gastoVinculadoId, rid);
  assert.equal(r.tarjetas.oca.compras[0].contraparteNombre, "Bruno");

  const o = (await getDoc(doc(dbAs(A), "reintegros", rid))).data();
  assert.equal(o.sentido, "por_cobrar");
  assert.equal(o.monto, 56000);
  assert.equal(o.movimientoInicial, "ninguno");
  assert.equal(o.movimientoInicialTipo, "tarjeta");
  assert.equal(o.gastoVinculadoId, compraId);
  assert.equal(o.contraparteUid, null);
  assert.equal(o.contraparteNombre, "Bruno");
  assert.deepEqual(o.participantes, [A]);
  assert.equal(o.devuelto, 0);
  assert.equal(o.concepto, "Pasajes");
  assert.equal(o.registradoPor, A);
  assert.equal(o.registradoPorNombre, "Alice");
  assert.equal(o.fecha.toDate().getDate(), 10);

  const ev = await getDocs(
    collection(dbAs(A), "reintegros", rid, "eventos"),
  );
  assert.equal(ev.size, 1);
  const evento = ev.docs[0].data();
  assert.equal(evento.tipo, "creacion");
  assert.equal(evento.entidad, "obligacion");
  assert.equal(evento.monto, 56000);
  assert.equal(evento.sentido, "por_cobrar");
});

test("HT18 — atomicidad: si falla la obligación, la compra no se agrega", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });

  const rid = "rid-ht18";
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "reintegros", rid), {
      registradoPor: A,
      registradoPorNombre: "Alice",
      contraparteUid: null,
      contraparteNombre: "Otro",
      participantes: [A],
      sentido: "por_cobrar",
      monto: 1,
      devuelto: 0,
      movimientoInicial: "ninguno",
      concepto: "Ocupada",
      gastoVinculadoId: null,
      createdAt: Timestamp.now(),
    });
  });

  await rechaza(
    altaReintegro({
      rid,
      compra: { fecha: fecha(2026, 10, 10), detalle: "No debe entrar", monto: 9000 },
    }),
    "ESCRITURA_FALLIDA",
  );

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.compras.length, 0);
  const o = (await getDoc(doc(dbAs(A), "reintegros", rid))).data();
  assert.equal(o.concepto, "Ocupada");
});

test("HT18b — reintento con los mismos ids: no duplica compra ni obligación", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });

  const ids = { compraId: "c-ht18b", rid: "r-ht18b" };
  const a = await altaReintegro(ids);
  const b = await altaReintegro(ids);

  assert.equal(a.compraId, b.compraId);
  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.compras.length, 1);

  const ev = await getDocs(
    collection(dbAs(A), "reintegros", ids.rid, "eventos"),
  );
  assert.equal(ev.size, 1);
});

test("HT19 — baja sin cobros: elimina la compra y deja constancia en la obligación", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });
  const { compraId, rid } = await altaReintegro();

  await eliminarCompraVinculada({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    compraId,
    ahora: fecha(2026, 10, 15),
  });

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.compras.length, 0);

  const o = (await getDoc(doc(dbAs(A), "reintegros", rid))).data();
  assert.ok(o.eliminacion, "constancia de eliminación");
  assert.equal(o.eliminacion.eliminadaPor, A);
  assert.equal(o.eliminacion.motivo, "Se eliminó la compra con tarjeta");
  assert.equal(o.monto, 56000);

  const ev = await getDocs(
    collection(dbAs(A), "reintegros", rid, "eventos"),
  );
  const tipos = ev.docs.map((d) => d.data().tipo).sort();
  assert.deepEqual(tipos, ["creacion", "eliminacion"]);
});

test("HT20 — baja con cobros: COMPRA_CON_COBROS y cero escrituras", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });
  const { compraId, rid } = await altaReintegro();

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), "reintegros", rid), { devuelto: 1000 });
  });

  await rechaza(
    eliminarCompraVinculada({
      db: dbAs(A),
      uid: A,
      tarjetaId: "oca",
      compraId,
      ahora: fecha(2026, 10, 15),
    }),
    "COMPRA_CON_COBROS",
  );

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.compras.length, 1);
  const o = (await getDoc(doc(dbAs(A), "reintegros", rid))).data();
  assert.equal(o.eliminacion, undefined);
});

test("HT21 — editar monto + detalle + nombre: las dos pantallas coherentes", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });
  const { compraId, rid } = await altaReintegro({
    compra: { monto: 50000, detalle: "Pasajes" },
  });

  await editarCompraVinculada({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    compraId,
    cambios: {
      monto: 60000,
      detalle: "Pasajes 2",
      contraparteNombre: "Bruno 2",
      // El modal envía tipo/moneda read-only: iguales, no deben romper.
      tipo: "reintegro",
      moneda: "UYU",
    },
    ahora: fecha(2026, 10, 15),
  });

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.compras[0].monto, 60000);
  assert.equal(r.tarjetas.oca.compras[0].detalle, "Pasajes 2");
  assert.equal(r.tarjetas.oca.compras[0].contraparteNombre, "Bruno 2");

  const o = (await getDoc(doc(dbAs(A), "reintegros", rid))).data();
  assert.equal(o.monto, 60000);
  // 6.3-bis: el concepto ya NO es fotografía; se sincroniza en la 2.ª escritura.
  assert.equal(o.concepto, "Pasajes 2");
  assert.equal(o.contraparteNombre, "Bruno 2");

  const ev = await getDocs(
    collection(dbAs(A), "reintegros", rid, "eventos"),
  );
  const edicion = ev.docs
    .map((d) => d.data())
    .find((e) => e.tipo === "edicion");
  assert.ok(edicion);
  assert.equal(edicion.montoAnterior, 50000);
  assert.equal(edicion.montoNuevo, 60000);
});

test("HT21b — con cobros: detalle y nombre editables", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });
  const { compraId, rid } = await altaReintegro({
    compra: { monto: 56000, detalle: "Pasajes" },
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), "reintegros", rid), {
      devuelto: 1000,
    });
  });

  await editarCompraVinculada({
    db: dbAs(A),
    uid: A,
    tarjetaId: "oca",
    compraId,
    cambios: {
      detalle: "Pasajes 3",
      contraparteNombre: "Bruno 3",
      tipo: "reintegro",
      moneda: "UYU",
    },
    ahora: fecha(2026, 10, 15),
  });

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.compras[0].monto, 56000);
  assert.equal(r.tarjetas.oca.compras[0].detalle, "Pasajes 3");
  assert.equal(r.tarjetas.oca.compras[0].contraparteNombre, "Bruno 3");

  const o = (await getDoc(doc(dbAs(A), "reintegros", rid))).data();
  assert.equal(o.monto, 56000);
  assert.equal(o.concepto, "Pasajes 3");
  assert.equal(o.contraparteNombre, "Bruno 3");
});

test("HT21c — con cobros, la edición mixta se rechaza antes de escribir y la compra queda intacta", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });
  const { compraId, rid } = await altaReintegro({
    compra: { monto: 56000, detalle: "Pasajes" },
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), "reintegros", rid), {
      devuelto: 1000,
    });
  });

  await rechaza(
    editarCompraVinculada({
      db: dbAs(A),
      uid: A,
      tarjetaId: "oca",
      compraId,
      cambios: {
        monto: 60000,
        detalle: "No entra",
        contraparteNombre: "No entra",
        tipo: "reintegro",
        moneda: "UYU",
      },
      ahora: fecha(2026, 10, 15),
    }),
    "MONTO_BLOQUEADO",
  );

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  const compra = r.tarjetas.oca.compras[0];
  assert.equal(compra.monto, 56000);
  assert.equal(compra.detalle, "Pasajes");
  assert.equal(compra.contraparteNombre, "Bruno");

  const o = (await getDoc(doc(dbAs(A), "reintegros", rid))).data();
  assert.equal(o.monto, 56000);
  assert.equal(o.concepto, "Pasajes");
  assert.equal(o.contraparteNombre, "Bruno");
});

test("HT22 — editar monto con cobros o cerrada: bloqueado sin escritura", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });

  const conCobros = await altaReintegro({
    compra: { monto: 40000 },
    compraId: "c-ht22a",
    rid: "r-ht22a",
  });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), "reintegros", conCobros.rid), {
      devuelto: 500,
    });
  });
  await rechaza(
    editarCompraVinculada({
      db: dbAs(A),
      uid: A,
      tarjetaId: "oca",
      compraId: conCobros.compraId,
      cambios: { monto: 45000 },
      ahora: fecha(2026, 10, 15),
    }),
    "MONTO_BLOQUEADO",
  );

  const cerrada = await altaReintegro({
    compra: { monto: 30000 },
    compraId: "c-ht22b",
    rid: "r-ht22b",
  });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), "reintegros", cerrada.rid), {
      condonacion: { condonadaPor: A, createdAt: Timestamp.now() },
    });
  });
  await rechaza(
    editarCompraVinculada({
      db: dbAs(A),
      uid: A,
      tarjetaId: "oca",
      compraId: cerrada.compraId,
      cambios: { monto: 35000 },
      ahora: fecha(2026, 10, 15),
    }),
    "OBLIGACION_CERRADA",
  );
  await rechaza(
    eliminarCompraVinculada({
      db: dbAs(A),
      uid: A,
      tarjetaId: "oca",
      compraId: cerrada.compraId,
      ahora: fecha(2026, 10, 15),
    }),
    "OBLIGACION_CERRADA",
  );

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.compras.length, 2);
  assert.equal(r.tarjetas.oca.compras.find((c) => c.id === "c-ht22a").monto, 40000);
  assert.equal(r.tarjetas.oca.compras.find((c) => c.id === "c-ht22b").monto, 30000);
});

test("HT23 — reintegro USD y tipo/moneda inmutables: rechazados sin escritura", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });

  await rechaza(
    altaReintegro({ compra: { moneda: "USD", monto: 200 } }),
    "REINTEGRO_EN_USD",
  );
  await rechaza(
    altaReintegro({ compra: { tipo: "personal" } }),
    "REINTEGRO_INVALIDO",
  );

  const { compraId } = await altaReintegro();
  await rechaza(
    editarCompraVinculada({
      db: dbAs(A),
      uid: A,
      tarjetaId: "oca",
      compraId,
      cambios: { tipo: "personal" },
      ahora: fecha(2026, 10, 15),
    }),
    "COMPRA_INVALIDA",
  );
  await rechaza(
    editarCompraVinculada({
      db: dbAs(A),
      uid: A,
      tarjetaId: "oca",
      compraId,
      cambios: { moneda: "USD" },
      ahora: fecha(2026, 10, 15),
    }),
    "COMPRA_INVALIDA",
  );

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.compras.length, 1);
  assert.equal(r.tarjetas.oca.compras[0].moneda, "UYU");
});
test("HT25 — recrear vínculo eliminado: sin cobros recrea; con cobros requiere revisión", async () => {
  await guardarTarjeta({ db: dbAs(A), uid: A, tarjetaId: "oca", config: OCA });
  const { compraId, rid } = await altaReintegro({
    compra: { monto: 70000, detalle: "Pasajes" },
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), "reintegros", rid), {
      eliminacion: {
        eliminadaPor: A,
        createdAt: Timestamp.now(),
        motivo: "eliminada desde /reintegros",
      },
    });
  });

  const v = await leerVinculos({ db: dbAs(A), rids: [rid] });
  assert.equal(v[rid].estado, "eliminada");
  assert.equal(v[rid].devuelto, 0);
  assert.equal(v[rid].contraparteNombre, "Bruno");

  const rec = await recrearReintegro({
    db: dbAs(A),
    uid: A,
    uidNombre: "Alice",
    tarjetaId: "oca",
    compraId,
    ahora: fecha(2026, 10, 15),
  });
  assert.ok(rec.rid);
  assert.notEqual(rec.rid, rid);

  const r = await leerTarjetas({ db: dbAs(A), uid: A });
  assert.equal(r.tarjetas.oca.compras[0].gastoVinculadoId, rec.rid);
  assert.equal(r.tarjetas.oca.compras[0].contraparteNombre, "Bruno");

  const nuevo = (await getDoc(doc(dbAs(A), "reintegros", rec.rid))).data();
  assert.equal(nuevo.eliminacion, undefined);
  assert.equal(nuevo.gastoVinculadoId, compraId);
  assert.equal(nuevo.monto, 70000);
  assert.equal(nuevo.contraparteNombre, "Bruno");
  assert.equal(nuevo.movimientoInicialTipo, "tarjeta");

  const viejo = (await getDoc(doc(dbAs(A), "reintegros", rid))).data();
  assert.ok(viejo.eliminacion, "el vínculo viejo queda como histórico");

  const ev = await getDocs(
    collection(dbAs(A), "reintegros", rec.rid, "eventos"),
  );
  assert.equal(ev.size, 1);
  assert.equal(ev.docs[0].data().tipo, "creacion");

  // Con cobros: no se recrea; requiere revisión manual y no escribe.
  const dos = await altaReintegro({
    compra: { monto: 30000 },
    compraId: "c-ht25b",
    rid: "r-ht25b",
  });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), "reintegros", dos.rid), {
      devuelto: 1000,
      eliminacion: {
        eliminadaPor: A,
        createdAt: Timestamp.now(),
        motivo: "eliminada con cobros",
      },
    });
  });

  await rechaza(
    recrearReintegro({
      db: dbAs(A),
      uid: A,
      uidNombre: "Alice",
      tarjetaId: "oca",
      compraId: dos.compraId,
      ahora: fecha(2026, 10, 15),
    }),
    "REVISION_MANUAL",
  );

  const r2 = await leerTarjetas({ db: dbAs(A), uid: A });
  const compra2 = r2.tarjetas.oca.compras.find((c) => c.id === "c-ht25b");
  assert.equal(compra2.gastoVinculadoId, "r-ht25b");
});