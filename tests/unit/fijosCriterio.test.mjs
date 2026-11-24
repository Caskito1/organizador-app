// tests/unit/fijosCriterio.test.mjs
// 5.1 (A-1) — criterio de los gastos fijos compartido por /gastos y el
// balance. Congela la regla de 2.2 (`esPagado`) y el 50 % hardcodeado para
// que la extracción a app/gastos/helpers/fijosCriterio.js no cambie ningún
// resultado de /gastos.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  esPagado,
  parteDelUsuarioDeFijo,
} from "../../app/gastos/helpers/fijosCriterio.js";

test("F-U01 — esPagado: paidByUid presente", () => {
  assert.equal(
    esPagado({ paidByUid: "uid_a", periodo: "2026-10", montoTotal: 1000 }),
    true,
  );
});

test("F-U02 — esPagado: sin pago, anual vigente por pagoHasta > periodo", () => {
  assert.equal(
    esPagado({
      paidByUid: null,
      periodo: "2026-10",
      pagoHasta: "2026-12",
    }),
    true,
  );
});

test("F-U03 — esPagado: pagoHasta igual al periodo no cubre", () => {
  assert.equal(
    esPagado({
      paidByUid: null,
      periodo: "2026-10",
      pagoHasta: "2026-10",
    }),
    false,
  );
});

test("F-U04 — esPagado: sin campos o null", () => {
  assert.equal(esPagado({}), false);
  assert.equal(esPagado(null), false);
  assert.equal(esPagado(undefined), false);
});

test("F-U05 — parteDelUsuarioDeFijo: personal = 100 %", () => {
  assert.equal(parteDelUsuarioDeFijo({ montoTotal: 1500 }), 1500);
});

test("F-U06 — parteDelUsuarioDeFijo: compartido = 50 % (impar ⇒ .5)", () => {
  assert.equal(parteDelUsuarioDeFijo({ montoTotal: 4000, groupId: "g1" }), 2000);
  assert.equal(parteDelUsuarioDeFijo({ montoTotal: 1059, groupId: "g1" }), 529.5);
});

test("F-U07 — parteDelUsuarioDeFijo: montoTotal ausente o string", () => {
  assert.equal(parteDelUsuarioDeFijo({}), 0);
  assert.equal(parteDelUsuarioDeFijo({ montoTotal: "1200", groupId: "g1" }), 600);
});

test("F-U08 — regresión 2.2: el anual futuro cuenta aunque estado sea impago", () => {
  const entries = [
    {
      paidByUid: null,
      estado: "pendiente_pago",
      periodo: "2026-10",
      pagoHasta: "2026-12",
    },
    {
      paidByUid: null,
      estado: "pendiente_pago",
      periodo: "2026-10",
      pagoHasta: null,
    },
  ];

  assert.deepEqual(entries.filter(esPagado), [entries[0]]);
});
