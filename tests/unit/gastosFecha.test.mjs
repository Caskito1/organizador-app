// tests/unit/gastosFecha.test.mjs
// 4.5-fecha — criterio de fecha del gasto diario (sin emulador).
//
// Protege el corazón del requerimiento: `fecha` manda; en los documentos
// históricos sin `fecha` se usa `createdAt` (fallback), sin migración.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  fechaEfectiva,
  fechaLocal,
  getMonthRange,
  hoyISO,
  isoDeFecha,
} from "../../app/gastos/helpers/dateHelpers.js";

// Timestamp mínimo (duck-typing de toDate), sin cargar el SDK.
function ts(anio, mes, dia) {
  return { toDate: () => new Date(anio, mes - 1, dia) };
}

test("fecha manda sobre createdAt (gasto cargado a mes vencido)", () => {
  const gasto = { fecha: ts(2026, 10, 5), createdAt: ts(2026, 11, 2) };
  const f = fechaEfectiva(gasto);

  assert.equal(f.getMonth(), 9); // octubre
  assert.equal(f.getDate(), 5);
});

test("sin fecha: fallback a createdAt (documento histórico)", () => {
  const gasto = { createdAt: ts(2026, 9, 15) };

  assert.equal(fechaEfectiva(gasto).getMonth(), 8); // septiembre
});

test("sin fecha ni createdAt: null (no inventa fecha)", () => {
  assert.equal(fechaEfectiva({}), null);
  assert.equal(fechaEfectiva(null), null);
  assert.equal(fechaEfectiva(undefined), null);
});

test("acepta Date y string además de Timestamp", () => {
  assert.equal(fechaEfectiva({ fecha: new Date(2026, 0, 2) }).getDate(), 2);
  assert.equal(fechaEfectiva({ fecha: "2026-03-04T12:00:00" }).getMonth(), 2);
});

test("un gasto de octubre no cae en el rango de noviembre", () => {
  const octubre = getMonthRange(new Date(2026, 9, 1));
  const noviembre = getMonthRange(new Date(2026, 10, 1));
  const gasto = { fecha: ts(2026, 10, 31), createdAt: ts(2026, 11, 2) };
  const f = fechaEfectiva(gasto);

  assert.ok(f >= octubre.start && f <= octubre.end);
  assert.ok(!(f >= noviembre.start && f <= noviembre.end));
});

test("un gasto de noviembre no cae en el rango de octubre", () => {
  const octubre = getMonthRange(new Date(2026, 9, 1));
  const f = fechaEfectiva({ fecha: ts(2026, 11, 1) });

  assert.ok(!(f >= octubre.start && f <= octubre.end));
});

test("fechaLocal/isoDeFecha conservan el día local (sin corrimiento)", () => {
  const d = fechaLocal("2026-10-05");

  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 9);
  assert.equal(d.getDate(), 5);
  assert.equal(d.getHours(), 0);
  assert.equal(isoDeFecha(d), "2026-10-05");
  assert.equal(isoDeFecha(ts(2026, 10, 5)), "2026-10-05");
});

test("hoyISO tiene formato YYYY-MM-DD", () => {
  assert.match(hoyISO(), /^\d{4}-\d{2}-\d{2}$/);
});
