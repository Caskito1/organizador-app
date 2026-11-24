// tests/unit/balancesFormato.test.mjs
// 5.2 — formato de la página /balances (es-AR), sin emulador.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  etiquetaConCurso,
  etiquetaMes,
  etiquetaMesCorto,
  formatearFecha,
  formatearMonto,
  formatearMontoConSigno,
  formatearUSD,
} from "../../app/balances/helpers/formato.js";

test("F-01 — monto positivo con miles", () => {
  assert.equal(formatearMonto(1234567), "$1.234.567");
});

test("F-02 — cero", () => {
  assert.equal(formatearMonto(0), "$0");
  assert.equal(formatearMonto(null), "$0");
});

test("F-03 — negativo", () => {
  assert.equal(formatearMonto(-1234), "-$1.234");
});

test("F-04 — USD", () => {
  assert.equal(formatearUSD(800), "US$ 800");
  assert.equal(formatearUSD(-50), "-US$ 50");
});

test("F-05 — etiqueta de mes, corta y fecha de corte", () => {
  assert.equal(etiquetaMes("2026-10"), "octubre 2026");
  assert.equal(etiquetaMesCorto("2026-10"), "oct");
  assert.equal(formatearFecha(new Date(2026, 9, 31)), "31/10/2026");
});

test("F-06 — «en curso», redondeo de promedios y flujo con signo", () => {
  assert.equal(etiquetaConCurso("2026-10", true), "octubre 2026 · en curso");
  assert.equal(etiquetaConCurso("2026-10", false), "octubre 2026");
  assert.equal(formatearMonto(1234.5), "$1.235");
  assert.equal(formatearMonto("abc"), "$0");

  assert.equal(formatearMontoConSigno(8400), "+$8.400");
  assert.equal(formatearMontoConSigno(-15000), "-$15.000");
  assert.equal(formatearMontoConSigno(0), "$0");
});
