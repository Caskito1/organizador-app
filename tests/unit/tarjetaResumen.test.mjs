// tests/unit/tarjetaResumen.test.mjs
// 6.2 — resumen y lista de presentación del ciclo (sin emulador). Protege
// PROPUESTA-ETAPA-6.md §12.7/§12.11:
// · la lista incluye TODA compra con una cuota en el ciclo (también 2/n, 3/n…);
// · apertura plegada UNA vez en Personales y conteos unificados;
// · `deudaTotal` = a pagar + por vencer (incluye la factura actual);
// · invariante Personales + Reintegros = Total.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  comprasDelCiclo,
  resumenCiclo,
} from "../../app/tarjetas/helpers/resumen.js";

function d(anio, mes1, dia) {
  return new Date(anio, mes1 - 1, dia);
}

function compra({ monto, cuotasTotal = 1, fecha, tipo = "personal", moneda = "UYU", detalle = "" }) {
  return { monto, cuotasTotal, fecha, tipo, moneda, detalle };
}

const OCA = { diaCierre: 18, diaVencimiento: 30 };

test("comprasDelCiclo: incluye las compras de ciclos anteriores (2/n, 3/n…)", () => {
  const compras = [
    // Ciclo 2026-09; en 2026-10 va 2/6.
    compra({ monto: 108000, cuotasTotal: 6, fecha: d(2026, 9, 10), detalle: "Computadora" }),
    // Ciclo 2026-10; en 2026-10 va 1/12.
    compra({ monto: 300000, cuotasTotal: 12, fecha: d(2026, 10, 2), detalle: "Notebook" }),
    compra({ monto: 9000, fecha: d(2026, 10, 15), detalle: "Cena" }),
    // Día 19 → ciclo 2026-11; no aparece en 2026-10.
    compra({ monto: 50000, fecha: d(2026, 10, 19), detalle: "Del 19" }),
  ];

  const lista = comprasDelCiclo({ compras, cicloKey: "2026-10", ...OCA });

  assert.deepEqual(
    lista.map((item) => item.compra.detalle),
    ["Computadora", "Notebook", "Cena"],
  );
  assert.equal(lista[0].cuota.n, 2);
  assert.equal(lista[0].cuota.total, 6);
  assert.equal(lista[1].cuota.n, 1);
  assert.equal(lista[2].cuota.n, 1);
});

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
  // Deuda total = a pagar (86.000) + por vencer (90.000).
  assert.deepEqual(r.deudaPorVencer, { UYU: 90000, USD: 0 });
  assert.deepEqual(r.deudaTotal, { UYU: 176000, USD: 0 });
  assert.equal(r.cuotasDelCiclo, 3);
  assert.equal(r.cuotasPorVencer, 5);
  assert.equal(r.cuotasTotales, 8);
});

test("§8.2: deuda total = 399.000 (incluye la factura actual)", () => {
  const compras = [
    // Cuota 2/6 en 2026-10.
    compra({ monto: 108000, cuotasTotal: 6, fecha: d(2026, 9, 10) }),
    // Cuota 1/12 en 2026-10.
    compra({ monto: 300000, cuotasTotal: 12, fecha: d(2026, 10, 2) }),
    compra({ monto: 9000, fecha: d(2026, 10, 15) }),
  ];

  const r = resumenCiclo({ compras, apertura: [], cicloKey: "2026-10", ...OCA });

  assert.deepEqual(r.total, { UYU: 52000, USD: 0 });
  assert.deepEqual(r.deudaPorVencer, { UYU: 347000, USD: 0 });
  assert.deepEqual(r.deudaTotal, { UYU: 399000, USD: 0 });
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

  assert.equal(r.cuotasDelCiclo, 2);
  assert.equal(r.cuotasPorVencer, 5 + 11);
  assert.equal(r.cuotasTotales, 2 + 5 + 11);
});

test("vacío: todo en cero", () => {
  const r = resumenCiclo({ compras: [], apertura: [], cicloKey: "2026-10", ...OCA });

  assert.deepEqual(r.personales, { UYU: 0, USD: 0 });
  assert.deepEqual(r.reintegros, { UYU: 0, USD: 0 });
  assert.deepEqual(r.total, { UYU: 0, USD: 0 });
  assert.deepEqual(r.deudaPorVencer, { UYU: 0, USD: 0 });
  assert.deepEqual(r.deudaTotal, { UYU: 0, USD: 0 });
  assert.equal(r.cuotasDelCiclo, 0);
  assert.equal(r.cuotasPorVencer, 0);
  assert.equal(r.cuotasTotales, 0);
});
