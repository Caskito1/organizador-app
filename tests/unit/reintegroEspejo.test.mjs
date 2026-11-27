// tests/unit/reintegroEspejo.test.mjs
// 6.3 — espejo H-2 (sin emulador). Una obligación nacida de tarjeta NO mueve
// caja, ni propia ni espejo: el registrador nace con movimientoInicial
// "ninguno" y la contraparte miembro no bookkea entrada ni salida. La
// asimetría dinero/ítem del dominio queda intacta (no simetrizar).

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  entradasDelMes,
  salidasDelMes,
  saldoDe,
} from "../../app/reintegros/helpers/modelo.js";

const A = "uid_alice";
const B = "uid_bob";
const C = "uid_carol";

const START = new Date(2026, 9, 1); // octubre 2026
const NEXT = new Date(2026, 10, 1); // noviembre 2026

function obl(over = {}) {
  return {
    id: "o1",
    registradoPor: A,
    registradoPorNombre: "Alice",
    contraparteUid: B,
    contraparteNombre: "Bob",
    participantes: [A, B],
    sentido: "por_cobrar",
    monto: 50000,
    devuelto: 0,
    movimientoInicial: "ninguno",
    movimientoInicialTipo: "tarjeta",
    concepto: "Pasajes",
    fecha: new Date(2026, 9, 10),
    createdAt: new Date(2026, 9, 10),
    ...over,
  };
}

function mes(uid, obligaciones) {
  const args = { obligaciones, entregas: [], uid, start: START, nextStart: NEXT };
  return {
    entradas: entradasDelMes(args),
    salidas: salidasDelMes(args),
  };
}

test("U9 — miembro + tarjeta: 0 entrada y 0 salida en ambas partes", () => {
  const o = obl();
  assert.deepEqual(mes(A, [o]), { entradas: 0, salidas: 0 });
  assert.deepEqual(mes(B, [o]), { entradas: 0, salidas: 0 });
  // La deuda existe y se ve.
  assert.equal(saldoDe(o), 50000);
});

test("U10 — registrador + tarjeta: no mueve caja; la deuda existe", () => {
  const o = obl({ contraparteUid: null, participantes: [A], contraparteNombre: "Tercero" });
  assert.deepEqual(mes(A, [o]), { entradas: 0, salidas: 0 });
  assert.equal(saldoDe(o), 50000);
});

test("U11 — externa + tarjeta: sin espejo para nadie", () => {
  const o = obl({ contraparteUid: null, participantes: [A], contraparteNombre: "Tercero" });
  assert.deepEqual(mes(A, [o]), { entradas: 0, salidas: 0 });
  assert.deepEqual(mes(C, [o]), { entradas: 0, salidas: 0 });
});

test("U12 — regresión: el espejo dinero/ítem sigue como antes (no simetrizar)", () => {
  // Miembro por_cobrar con dinero → la contraparte ve entrada espejo.
  const porCobrar = obl({
    id: "dinero",
    movimientoInicial: "salida",
    movimientoInicialTipo: "dinero",
  });
  assert.equal(mes(B, [porCobrar]).entradas, 50000);
  assert.equal(mes(B, [porCobrar]).salidas, 0);

  // Miembro por_devolver (la registró quien recibe) → la contraparte ve salida.
  const porDevolver = obl({
    id: "devolver",
    sentido: "por_devolver",
    movimientoInicial: "entrada",
    movimientoInicialTipo: undefined,
  });
  assert.equal(mes(B, [porDevolver]).salidas, 50000);
  assert.equal(mes(B, [porDevolver]).entradas, 0);

  // Un ítem no genera entrada espejo (pero la deuda existe).
  const item = obl({
    id: "item",
    movimientoInicial: "ninguno",
    movimientoInicialTipo: "item",
  });
  assert.equal(mes(B, [item]).entradas, 0);
});
