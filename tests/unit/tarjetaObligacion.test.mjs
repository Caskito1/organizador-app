// tests/unit/tarjetaObligacion.test.mjs
// 6.3 — obligación de reintegro derivada de una compra (sin emulador).
// Protege PROPUESTA-ETAPA-6.md §13.3.2: una sola obligación por el TOTAL,
// sin movimiento de caja, contraparte externa y vínculo a la compra.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CONCEPTO_POR_DEFECTO,
  obligacionDeCompra,
} from "../../app/tarjetas/helpers/obligacion.js";

const UID = "uid_alice";
const NOMBRE = "Alice";

function compra(over = {}) {
  return {
    id: "compra-1",
    fecha: new Date(2026, 10, 20),
    detalle: "Pasajes",
    monto: 56000,
    moneda: "UYU",
    cuotasTotal: 1,
    tipo: "reintegro",
    gastoVinculadoId: null,
    ...over,
  };
}

function base(over = {}) {
  return {
    uid: UID,
    uidNombre: NOMBRE,
    compra: compra(),
    contraparteNombre: "Bruno",
    ...over,
  };
}

function rechaza(args, codigo) {
  assert.throws(
    () => obligacionDeCompra(args),
    (error) => error?.codigo === codigo,
  );
}

test("U1 — forma exacta: externa, UYU, por el total, sin caja", () => {
  const o = obligacionDeCompra(base());

  assert.equal(o.sentido, "por_cobrar");
  assert.equal(o.monto, 56000);
  assert.equal(o.movimientoInicial, "ninguno");
  assert.equal(o.movimientoInicialTipo, "tarjeta");
  assert.equal(o.gastoVinculadoId, "compra-1");
  assert.equal(o.contraparteUid, null);
  assert.equal(o.contraparteNombre, "Bruno");
  assert.deepEqual(o.participantes, [UID]);
  assert.equal(o.groupId, null);
  assert.equal(o.concepto, "Pasajes");
  assert.equal(o.detalle, null);
  assert.equal(o.registradoPorNombre, NOMBRE);
  assert.ok(o.fecha instanceof Date);
});

test("U2 — compra en 6 cuotas: una sola obligación por el TOTAL (no divide)", () => {
  const o = obligacionDeCompra(
    base({ compra: compra({ monto: 108000, cuotasTotal: 6 }) }),
  );
  assert.equal(o.monto, 108000);
  assert.equal(o.gastoVinculadoId, "compra-1");
});

test("U3 — concepto = detalle; detalle vacío usa el fallback", () => {
  assert.equal(obligacionDeCompra(base()).concepto, "Pasajes");
  assert.equal(
    obligacionDeCompra(base({ compra: compra({ detalle: "   " }) })).concepto,
    CONCEPTO_POR_DEFECTO,
  );
});

test("U4 — nombre de la contraparte vacío: REINTEGRO_INVALIDO", () => {
  rechaza(base({ contraparteNombre: "  " }), "REINTEGRO_INVALIDO");
  rechaza(base({ contraparteNombre: null }), "REINTEGRO_INVALIDO");
});

test("U5 — compra en USD: REINTEGRO_EN_USD", () => {
  rechaza(base({ compra: compra({ moneda: "USD" }) }), "REINTEGRO_EN_USD");
});

test("U6 — monto no entero/0 y cuotas 0: REINTEGRO_INVALIDO", () => {
  rechaza(base({ compra: compra({ monto: 1.5 }) }), "REINTEGRO_INVALIDO");
  rechaza(base({ compra: compra({ monto: 0 }) }), "REINTEGRO_INVALIDO");
  rechaza(base({ compra: compra({ cuotasTotal: 0 }) }), "REINTEGRO_INVALIDO");
});

test("U7 — tipo personal: el helper rechaza (el flujo personal no lo llama)", () => {
  rechaza(base({ compra: compra({ tipo: "personal" }) }), "REINTEGRO_INVALIDO");
});

test("U8 — la fecha de la obligación es la de la compra (mismo día local)", () => {
  const fecha = new Date(2026, 9, 5);
  const o = obligacionDeCompra(base({ compra: compra({ fecha }) }));
  assert.equal(o.fecha.getFullYear(), 2026);
  assert.equal(o.fecha.getMonth(), 9);
  assert.equal(o.fecha.getDate(), 5);
});
