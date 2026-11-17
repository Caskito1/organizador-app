// tests/unit/ingresosMoneda.test.mjs
// 5.0 — Sueldo multimoneda: derivación de moneda y totales por moneda
// (sin emulador: el módulo es puro).
//
// Protege el corazón del requerimiento: la moneda se DERIVA del subtipo,
// `USD` solo para `sueldo_dolares`, los documentos sin `moneda` cuentan como
// UYU y ningún total suma monedas distintas.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SUELDOS,
  UYU,
  USD,
  monedaDeSubtipo,
  monedaEfectiva,
  simboloDe,
  sumarPorMoneda,
  agruparSueldoPorSubtipo,
} from "../../app/ingresos/helpers/ingresosMoneda.js";

const ingreso = (over = {}) => ({
  tipo: "sueldo",
  subtipo: "sueldo_pesos",
  monto: 1000,
  ...over,
});

test("U1 — monedaDeSubtipo: los cinco subtipos de D-7 (solo sueldo_dolares es USD)", () => {
  assert.equal(monedaDeSubtipo("sueldo_pesos"), UYU);
  assert.equal(monedaDeSubtipo("sueldo_dolares"), USD);
  assert.equal(monedaDeSubtipo("aguinaldo"), UYU);
  assert.equal(monedaDeSubtipo("salario_vacacional"), UYU);
  assert.equal(monedaDeSubtipo("otro"), UYU);
  // Los cinco existen y en el orden canónico de la UI.
  assert.deepEqual(
    SUELDOS.map((s) => s.id),
    [
      "sueldo_pesos",
      "sueldo_dolares",
      "aguinaldo",
      "salario_vacacional",
      "otro",
    ],
  );
});

test("U2 — monedaDeSubtipo: sin subtipo (legacy) o valores no canónicos → UYU", () => {
  assert.equal(monedaDeSubtipo(null), UYU);
  assert.equal(monedaDeSubtipo(undefined), UYU);
  assert.equal(monedaDeSubtipo(""), UYU);
  assert.equal(monedaDeSubtipo("laventolera"), UYU); // una banda jamás es USD
});

test("U3 — monedaEfectiva: fallback a UYU (D-6) y tolerancia a valores raros", () => {
  assert.equal(monedaEfectiva(ingreso()), UYU); // documento anterior a 5.0
  assert.equal(monedaEfectiva(ingreso({ moneda: USD })), USD);
  assert.equal(monedaEfectiva(ingreso({ moneda: UYU })), UYU);
  assert.equal(monedaEfectiva(ingreso({ moneda: "ars" })), UYU);
  assert.equal(monedaEfectiva(null), UYU);
});

test("U4 — sumarPorMoneda: nunca suma monedas distintas", () => {
  const items = [
    ingreso({ monto: 1000 }), // UYU (sin campo)
    ingreso({ monto: 700, moneda: UYU }),
    ingreso({ monto: 500, moneda: USD, subtipo: "sueldo_dolares" }),
    ingreso({ monto: 300, moneda: USD, subtipo: "sueldo_dolares" }),
  ];
  assert.equal(sumarPorMoneda(items, UYU), 1700);
  assert.equal(sumarPorMoneda(items, USD), 800);
  // La suma de ambos nunca es un total válido: 2500 no se usa en ningún lado.
  assert.notEqual(
    sumarPorMoneda(items, UYU) + sumarPorMoneda(items, USD),
    sumarPorMoneda(items, UYU),
  );
});

test("U5 — sumarPorMoneda: lista vacía o ausente → 0", () => {
  assert.equal(sumarPorMoneda([], USD), 0);
  assert.equal(sumarPorMoneda(undefined, UYU), 0);
  assert.equal(sumarPorMoneda([ingreso({ monto: null })], UYU), 0);
});

test("U6 — agruparSueldoPorSubtipo: un grupo por subtipo en el orden canónico de D-7", () => {
  const items = [
    ingreso({ id: "b", subtipo: "aguinaldo", monto: 200 }),
    ingreso({ id: "a", subtipo: "sueldo_pesos", monto: 100 }),
    ingreso({ id: "c", subtipo: "sueldo_dolares", monto: 500 }),
  ];
  const grupos = agruparSueldoPorSubtipo(items);
  assert.deepEqual(
    grupos.map((g) => g.id),
    ["sueldo_pesos", "sueldo_dolares", "aguinaldo"],
  );
  assert.deepEqual(
    grupos.map((g) => g.label),
    ["Sueldo en pesos", "Sueldo en dólares", "Aguinaldo"],
  );
  // Solo grupos con ítems.
  assert.ok(grupos.every((g) => g.items.length > 0));
});

test("U7 — agruparSueldoPorSubtipo: el grupo legacy «Sueldo» va AL FINAL y cuenta como UYU", () => {
  const items = [
    ingreso({ id: "legacy1", subtipo: null }),
    ingreso({ id: "legacy2", subtipo: undefined }),
    ingreso({ id: "a", subtipo: "sueldo_dolares", moneda: USD }),
  ];
  const grupos = agruparSueldoPorSubtipo(items);
  assert.equal(grupos[0].id, "sueldo_dolares");
  const legacy = grupos[grupos.length - 1];
  assert.equal(legacy.id, null);
  assert.equal(legacy.label, "Sueldo");
  assert.equal(legacy.items.length, 2);
  assert.equal(sumarPorMoneda(legacy.items, UYU), 2000);
  assert.equal(sumarPorMoneda(legacy.items, USD), 0);
});

test("U8 — simboloDe: US$ para dólares, $ para pesos", () => {
  assert.equal(simboloDe(USD), "US$");
  assert.equal(simboloDe(UYU), "$");
  assert.equal(simboloDe(undefined), "$");
});
