// tests/unit/tarjetaDeuda.test.mjs
// 6.0 — desglose del ciclo y stock (sin emulador). Protege PROPUESTA-ETAPA-6.md
// §10.8 con los fixtures canónicos de §8.1 y §8.2, bimoneda y apertura.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  desgloseCiclo,
  aPagarDelCiclo,
  deudaPorVencer,
  deudaTotal,
} from "../../app/tarjetas/helpers/deuda.js";

function d(anio, mes1, dia) {
  return new Date(anio, mes1 - 1, dia);
}

function compra({ monto, cuotasTotal = 1, fecha, tipo = "personal", moneda = "UYU" }) {
  return { monto, cuotasTotal, fecha, tipo, moneda };
}

const OCA = { diaCierre: 18, diaVencimiento: 30 };

test("§8.1: cuotas + reintegro en el mismo ciclo", () => {
  const compras = {
    zapatillas: compra({ monto: 12000, cuotasTotal: 1, fecha: d(2026, 10, 5) }),
    heladera: compra({ monto: 108000, cuotasTotal: 6, fecha: d(2026, 10, 10) }),
    pasajes: compra({
      monto: 56000,
      cuotasTotal: 1,
      fecha: d(2026, 10, 12),
      tipo: "reintegro",
    }),
  };

  const desglose = desgloseCiclo({
    compras,
    apertura: {},
    cicloKey: "2026-10",
    ...OCA,
  });

  assert.deepEqual(desglose.personales, { UYU: 30000, USD: 0 });
  assert.deepEqual(desglose.reintegros, { UYU: 56000, USD: 0 });
  assert.deepEqual(desglose.total, { UYU: 86000, USD: 0 });
  assert.deepEqual(desglose.deudaPorVencer, { UYU: 90000, USD: 0 });
  assert.equal(desglose.cuotasDelCiclo, 3);
  assert.equal(desglose.cuotasPorVencer, 5);
});

test("§8.2: arrastre de cuotas y compra del día 19 fuera del ciclo", () => {
  const compras = {
    // Cuota 2/6 en 2026-10 (la compra fue en 2026-09).
    computadora: compra({ monto: 108000, cuotasTotal: 6, fecha: d(2026, 9, 10) }),
    // Cuota 1/12 en 2026-10.
    notebook: compra({ monto: 300000, cuotasTotal: 12, fecha: d(2026, 10, 2) }),
    cena: compra({ monto: 9000, cuotasTotal: 1, fecha: d(2026, 10, 15) }),
    // Día 19 → pertenece al ciclo 2026-11, no aparece.
    del19: compra({ monto: 50000, cuotasTotal: 1, fecha: d(2026, 10, 19) }),
  };

  const args = { compras, apertura: {}, cicloKey: "2026-10", ...OCA };

  assert.deepEqual(aPagarDelCiclo(args), { UYU: 52000, USD: 0 });
  assert.deepEqual(deudaPorVencer(args), { UYU: 347000, USD: 0 });
  assert.deepEqual(deudaTotal(args), { UYU: 399000, USD: 0 });
});

test("bimoneda: UYU y USD nunca se suman", () => {
  const compras = {
    uyu: compra({ monto: 10000, cuotasTotal: 1, fecha: d(2026, 10, 5), moneda: "UYU" }),
    usd: compra({ monto: 500, cuotasTotal: 1, fecha: d(2026, 10, 6), moneda: "USD" }),
  };

  const desglose = desgloseCiclo({
    compras,
    apertura: {},
    cicloKey: "2026-10",
    ...OCA,
  });

  assert.deepEqual(desglose.total, { UYU: 10000, USD: 500 });
  // Una compra USD no afecta el total en pesos.
  assert.equal(desglose.total.UYU, 10000);
});

test("vacío: sin compras ni apertura todo en {0,0}", () => {
  const desglose = desgloseCiclo({
    compras: {},
    apertura: {},
    cicloKey: "2026-10",
    ...OCA,
  });

  assert.deepEqual(desglose.personales, { UYU: 0, USD: 0 });
  assert.deepEqual(desglose.reintegros, { UYU: 0, USD: 0 });
  assert.deepEqual(desglose.apertura, { UYU: 0, USD: 0 });
  assert.deepEqual(desglose.total, { UYU: 0, USD: 0 });
  assert.deepEqual(desglose.deudaPorVencer, { UYU: 0, USD: 0 });
  assert.equal(desglose.cuotasDelCiclo, 0);
  assert.equal(desglose.cuotasPorVencer, 0);
});

test("apertura: suma al a pagar y al stock, sin duplicarse en personales", () => {
  const apertura = {
    opencodeGo: {
      descripcion: "opencodeGo",
      moneda: "UYU",
      montoCuota: 5000,
      cuotasTotal: 12,
      desdeCiclo: "2026-10",
    },
  };

  const desglose = desgloseCiclo({
    compras: {},
    apertura,
    cicloKey: "2026-10",
    ...OCA,
  });

  // personales NO incluye apertura (ajuste iii): va en su propio campo.
  assert.deepEqual(desglose.personales, { UYU: 0, USD: 0 });
  assert.deepEqual(desglose.apertura, { UYU: 5000, USD: 0 });
  assert.deepEqual(desglose.total, { UYU: 5000, USD: 0 });
  assert.deepEqual(desglose.deudaPorVencer, { UYU: 55000, USD: 0 });
});
