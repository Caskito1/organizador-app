// tests/unit/tarjetaCuota.test.mjs
// 6.0 — cuota frente al ciclo (sin emulador). Protege PROPUESTA-ETAPA-6.md
// §10.5: cuota n/total derivada de fecha + cuotasTotal, redondeo entero con el
// resto en la última cuota, restantes y stock.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  montoCuotaDe,
  cuotaEnCiclo,
  cuotaActualDe,
  cuotasRestantesDe,
  deudaRestanteDe,
  cicloDeCuota,
  etiquetaCuota,
} from "../../app/tarjetas/helpers/cuota.js";

function d(anio, mes1, dia) {
  return new Date(anio, mes1 - 1, dia);
}

function compra({ monto, cuotasTotal = 1, fecha, tipo = "personal", moneda = "UYU" }) {
  return { monto, cuotasTotal, fecha, tipo, moneda };
}

const heladera = compra({
  monto: 108000,
  cuotasTotal: 6,
  fecha: d(2026, 10, 10),
});

test("cuotaEnCiclo: cuota 1 en el ciclo de la compra", () => {
  const c = cuotaEnCiclo(heladera, "2026-10", 18, 30);
  assert.equal(c.n, 1);
  assert.equal(c.total, 6);
  assert.equal(c.monto, 18000);
  assert.equal(c.esUltima, false);
});

test("cuotaEnCiclo: avanza una cuota por ciclo", () => {
  assert.equal(cuotaEnCiclo(heladera, "2026-11", 18, 30).n, 2);
  const ultima = cuotaEnCiclo(heladera, "2027-03", 18, 30);
  assert.equal(ultima.n, 6);
  assert.equal(ultima.esUltima, true);
});

test("cuotaEnCiclo: fuera de la vida útil → null", () => {
  assert.equal(cuotaEnCiclo(heladera, "2027-04", 18, 30), null);
  assert.equal(cuotaEnCiclo(heladera, "2026-09", 18, 30), null);
});

test("montoCuotaDe: resto entero en la última cuota (100.000/3)", () => {
  const c = compra({ monto: 100000, cuotasTotal: 3, fecha: d(2026, 10, 1) });
  assert.equal(montoCuotaDe(c, 1), 33333);
  assert.equal(montoCuotaDe(c, 2), 33333);
  assert.equal(montoCuotaDe(c, 3), 33334);
  assert.equal(montoCuotaDe(c, 1) + montoCuotaDe(c, 2) + montoCuotaDe(c, 3), 100000);
});

test("montoCuotaDe: 1 cuota paga el total", () => {
  const c = compra({ monto: 12000, cuotasTotal: 1, fecha: d(2026, 10, 1) });
  assert.equal(montoCuotaDe(c, 1), 12000);
  const enCiclo = cuotaEnCiclo(c, "2026-10", 18, 30);
  assert.equal(enCiclo.n, 1);
  assert.equal(enCiclo.monto, 12000);
  assert.equal(enCiclo.esUltima, true);
});

test("cuotaEnCiclo: compra el día 19 abre el ciclo siguiente", () => {
  const c = compra({ monto: 60000, cuotasTotal: 3, fecha: d(2026, 11, 19) });
  assert.equal(cuotaEnCiclo(c, "2026-12", 18, 30).n, 1);
  assert.equal(cuotaEnCiclo(c, "2026-11", 18, 30), null);
});

test("cuotaEnCiclo: compra el día 18 queda en el ciclo que cierra", () => {
  const c = compra({ monto: 60000, cuotasTotal: 3, fecha: d(2026, 12, 18) });
  assert.equal(cuotaEnCiclo(c, "2026-12", 18, 30).n, 1);
});

test("cuotasRestantesDe / deudaRestanteDe", () => {
  assert.equal(cuotasRestantesDe(heladera, "2026-11", 18, 30), 4);
  assert.equal(cuotasRestantesDe(heladera, "2027-03", 18, 30), 0);
  assert.equal(deudaRestanteDe(heladera, "2026-10", 18, 30), 90000);
  assert.equal(deudaRestanteDe(heladera, "2027-03", 18, 30), 0);
});

test("edge documentado: monto < cuotasTotal conserva la suma (3/5)", () => {
  const c = compra({ monto: 3, cuotasTotal: 5, fecha: d(2026, 10, 1) });
  const montos = [1, 2, 3, 4, 5].map((n) => montoCuotaDe(c, n));
  assert.deepEqual(montos, [0, 0, 0, 0, 3]);
  assert.equal(montos.reduce((a, n) => a + n, 0), 3);
});

test("cuotaActualDe y cicloDeCuota", () => {
  assert.equal(cuotaActualDe(heladera, "2026-11", 18, 30), 2);
  assert.equal(cicloDeCuota(heladera, 1, 18, 30), "2026-10");
  assert.equal(cicloDeCuota(heladera, 6, 18, 30), "2027-03");
});

test("etiquetaCuota", () => {
  assert.equal(etiquetaCuota(1, 6), "1/6");
  assert.equal(etiquetaCuota(6, 6), "6/6");
});
