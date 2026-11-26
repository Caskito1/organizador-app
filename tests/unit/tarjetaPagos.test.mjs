// tests/unit/tarjetaPagos.test.mjs
// 6.0 — pagos del resumen (A-1) y estados del ciclo (sin emulador). Protege
// PROPUESTA-ETAPA-6.md §10.9/§10.10 y la enmienda §9.1: un pago por ciclo POR
// MONEDA, atribución por fecha de pago, solo UYU para la caja.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  pagoDeCiclo,
  pagosTarjetaDelMes,
  pagoCubreCiclo,
  pagoRegistrado,
  etiquetaPago,
} from "../../app/tarjetas/helpers/pagos.js";
import {
  ESTADOS_CICLO,
  estadoCiclo,
  botonDelCiclo,
  esCicloPagable,
  esCicloPagado,
} from "../../app/tarjetas/helpers/estados.js";
import { etiquetaCuota } from "../../app/tarjetas/helpers/cuota.js";

function d(anio, mes1, dia) {
  return new Date(anio, mes1 - 1, dia);
}

const pagos = {
  "2026-12": {
    UYU: { monto: 86000, fecha: d(2026, 12, 30) },
    USD: { monto: 500, fecha: d(2026, 12, 30) },
  },
};

const DICIEMBRE = { desde: d(2026, 12, 1), hasta: d(2027, 1, 1) };
const NOVIEMBRE = { desde: d(2026, 11, 1), hasta: d(2026, 12, 1) };

test("pagoDeCiclo: objeto por ciclo/moneda", () => {
  assert.equal(pagoDeCiclo(pagos, "2026-12", "UYU").monto, 86000);
  assert.equal(pagoDeCiclo(pagos, "2026-12", "USD").monto, 500);
  assert.equal(pagoDeCiclo(pagos, "2026-12", "EUR"), null);
  assert.equal(pagoDeCiclo(pagos, "2026-11", "UYU"), null);
});

test("pagosTarjetaDelMes: atribuye por fecha y solo UYU", () => {
  // Diciembre: cuenta el UYU y NO el USD.
  assert.equal(pagosTarjetaDelMes({ pagos, ...DICIEMBRE }), 86000);
  // Noviembre: el pago de diciembre no cae ahí.
  assert.equal(pagosTarjetaDelMes({ pagos, ...NOVIEMBRE }), 0);
});

test("pagosTarjetaDelMes: un pago de noviembre cuenta en noviembre", () => {
  const pagosNov = {
    "2026-11": { UYU: { monto: 1000, fecha: d(2026, 11, 30) } },
  };
  assert.equal(pagosTarjetaDelMes({ pagos: pagosNov, ...NOVIEMBRE }), 1000);
  assert.equal(pagosTarjetaDelMes({ pagos: pagosNov, ...DICIEMBRE }), 0);
});

test("pagoCubreCiclo: exige cubrir cada moneda con deuda", () => {
  assert.equal(
    pagoCubreCiclo(pagos, "2026-12", { UYU: 86000, USD: 0 }),
    true,
  );
  assert.equal(
    pagoCubreCiclo(pagos, "2026-12", { UYU: 86001, USD: 0 }),
    false,
  );
  // USD con deuda y sin pago USD → no cubierto.
  assert.equal(
    pagoCubreCiclo(
      { "2026-12": { UYU: { monto: 86000, fecha: d(2026, 12, 30) } } },
      "2026-12",
      { UYU: 86000, USD: 500 },
    ),
    false,
  );
  // aPagar en cero → cubierto.
  assert.equal(pagoCubreCiclo({}, "2026-12", { UYU: 0, USD: 0 }), true);
});

test("pagoRegistrado", () => {
  assert.equal(pagoRegistrado(pagos, "2026-12", "UYU"), true);
  assert.equal(pagoRegistrado(pagos, "2026-12", "EUR"), false);
  assert.equal(pagoRegistrado({}, "2026-12", "UYU"), false);
});

test("estadoCiclo: default sin_verificar y validación", () => {
  assert.equal(estadoCiclo(undefined, "2026-12"), "sin_verificar");
  assert.equal(
    estadoCiclo({ "2026-12": { estado: "por_pagar" } }, "2026-12"),
    "por_pagar",
  );
  assert.equal(
    estadoCiclo({ "2026-12": { estado: "pagada" } }, "2026-12"),
    "pagada",
  );
  assert.equal(
    estadoCiclo({ "2026-12": { estado: "raro" } }, "2026-12"),
    "sin_verificar",
  );
  assert.deepEqual(ESTADOS_CICLO, ["sin_verificar", "por_pagar", "pagada"]);
});

test("botonDelCiclo y helpers de estado", () => {
  assert.equal(botonDelCiclo("sin_verificar"), "cargar");
  assert.equal(botonDelCiclo("por_pagar"), "pagar");
  assert.equal(botonDelCiclo("pagada"), null);

  const ciclos = { "2026-12": { estado: "por_pagar" } };
  assert.equal(esCicloPagable(ciclos, "2026-12"), true);
  assert.equal(esCicloPagado(ciclos, "2026-12"), false);
});

test("etiquetaCuota y etiquetaPago", () => {
  assert.equal(etiquetaCuota(1, 6), "1/6");
  assert.equal(
    etiquetaPago({ monto: 100, fecha: d(2026, 12, 30) }),
    "100 · 30/12",
  );
});
