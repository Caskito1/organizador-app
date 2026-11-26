// tests/unit/tarjetaResumen.test.mjs
// 6.2 — resumen de presentación del ciclo (sin emulador). Protege
// PROPUESTA-ETAPA-6.md §12.7/§12.11: apertura plegada UNA vez en Personales,
// conteos unificados (apertura en ambos) e invariante Personales + Reintegros = Total.

import { test } from "node:test";
import assert from "node:assert/strict";

import { resumenCiclo } from "../../app/tarjetas/helpers/resumen.js";

function d(anio, mes1, dia) {
  return new Date(anio, mes1 - 1, dia);
}

function compra({ monto, cuotasTotal = 1, fecha, tipo = "personal", moneda = "UYU" }) {
  return { monto, cuotasTotal, fecha, tipo, moneda };
}

const OCA = { diaCierre: 18, diaVencimiento: 30 };

test("§8.1: total, personales, reintegros y deuda", () => {
  const compras = [
    compra({ monto: 12000, fecha: d(2026, 10, 5) }),
    compra({ monto: 108000, cuotasTotal: 6, fecha: d(2026, 10, 10) }),
    compra({ monto: 56000, fecha: d(2026, 10, 12), tipo: "reintegro" }),
  ];

  const r = resumenCiclo({ compras, apertura: [], cicloKey: "2026-10", ...OCA });

  assert.deepEqual(r.personales, { UYU: 30000, USD: 0 });
  assert.deepEqual(r.reintegros, { UYU: 56000, USD: 0 });
  assert.deepEqual(r.total, { UYU: 86000, USD: 0 });
  assert.deepEqual(r.deudaPorVencer, { UYU: 90000, USD: 0 });
  assert.equal(r.cuotasDelCiclo, 3);
  assert.equal(r.cuotasPorVencer, 5);
});

test("invariante: personales + reintegros = total (por moneda)", () => {
  const compras = [
    compra({ monto: 10000, fecha: d(2026, 10, 5), moneda: "UYU" }),
    compra({ monto: 500, fecha: d(2026, 10, 6), moneda: "USD" }),
    compra({ monto: 7000, fecha: d(2026, 10, 7), tipo: "reintegro", moneda: "UYU" }),
  ];
  const plan = {
    descripcion: "opencodeGo",
    moneda: "UYU",
    montoCuota: 5000,
    cuotasTotal: 12,
    desdeCiclo: "2026-10",
  };

  const r = resumenCiclo({ compras, apertura: [plan], cicloKey: "2026-10", ...OCA });

  assert.equal(r.personales.UYU + r.reintegros.UYU, r.total.UYU);
  assert.equal(r.personales.USD + r.reintegros.USD, r.total.USD);
  // La apertura se pliega en Personales UNA sola vez.
  assert.equal(r.personales.UYU, 10000 + 5000);
  assert.equal(r.total.UYU, 10000 + 7000 + 5000);
  assert.equal(r.total.USD, 500);
});

test("conteos unificados: apertura suma a cuotasDelCiclo y a cuotasPorVencer", () => {
  const compras = [compra({ monto: 12000, cuotasTotal: 6, fecha: d(2026, 10, 5) })];
  const plan = {
    descripcion: "opencodeGo",
    moneda: "UYU",
    montoCuota: 5000,
    cuotasTotal: 12,
    desdeCiclo: "2026-10",
  };

  const r = resumenCiclo({ compras, apertura: [plan], cicloKey: "2026-10", ...OCA });

  // 1 cuota de compra + 1 cuota de apertura en el ciclo.
  assert.equal(r.cuotasDelCiclo, 2);
  // 5 cuotas futuras de la compra + 11 de apertura.
  assert.equal(r.cuotasPorVencer, 5 + 11);
});

test("vacío: todo en cero", () => {
  const r = resumenCiclo({ compras: [], apertura: [], cicloKey: "2026-10", ...OCA });

  assert.deepEqual(r.personales, { UYU: 0, USD: 0 });
  assert.deepEqual(r.reintegros, { UYU: 0, USD: 0 });
  assert.deepEqual(r.total, { UYU: 0, USD: 0 });
  assert.deepEqual(r.deudaPorVencer, { UYU: 0, USD: 0 });
  assert.equal(r.cuotasDelCiclo, 0);
  assert.equal(r.cuotasPorVencer, 0);
});
