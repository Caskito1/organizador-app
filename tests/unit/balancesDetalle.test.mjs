// tests/unit/balancesDetalle.test.mjs
// 5.2 — detalle del mes: las filas de sección deben atarse al contrato de 5.1
// (sin duplicar la lógica ni desalinearse de los totales).

import { test } from "node:test";
import assert from "node:assert/strict";

import { calcularBalanceDelMes } from "../../app/balance/helpers/balance.js";
import {
  detalleEgresos,
  detalleIngresos,
  detalleReintegros,
} from "../../app/balances/helpers/detalleMes.js";

const UID = "uid_a";
const OTRO = "uid_b";
const AHORA = new Date(2026, 11, 10, 12);

function ts(anio, mes, dia) {
  return { toDate: () => new Date(anio, mes - 1, dia) };
}

function datos() {
  return {
    gastos: [
      {
        id: "g1",
        usuario: UID,
        tipo: "personal",
        monto: 200,
        fecha: ts(2026, 10, 5),
      },
      {
        id: "g2",
        usuario: UID,
        tipo: "compartido",
        groupId: "grupo",
        monto: 100,
        fecha: ts(2026, 10, 6),
      },
    ],
    fixedEntries: [
      { id: "e1", usuario: UID, periodo: "2026-10", montoTotal: 50, paidByUid: UID },
      {
        id: "e2",
        usuario: UID,
        groupId: "grupo",
        periodo: "2026-10",
        montoTotal: 40,
        paidByUid: UID,
      },
    ],
    ingresos: [
      {
        id: "i1",
        usuario: UID,
        tipo: "sueldo",
        monto: 1000,
        moneda: "UYU",
        fecha: ts(2026, 10, 1),
      },
      {
        id: "i2",
        usuario: UID,
        tipo: "sueldo",
        subtipo: "sueldo_dolares",
        monto: 800,
        moneda: "USD",
        fecha: ts(2026, 10, 2),
      },
      {
        id: "i3",
        usuario: UID,
        tipo: "banda",
        monto: 500,
        moneda: "UYU",
        fecha: ts(2026, 10, 3),
      },
      {
        id: "i4",
        usuario: UID,
        tipo: "otros",
        monto: 300,
        createdAt: ts(2026, 10, 4),
      },
    ],
    obligaciones: [
      {
        id: "r1",
        registradoPor: UID,
        participantes: [UID, OTRO],
        sentido: "por_cobrar",
        monto: 300,
        devuelto: 100,
        movimientoInicial: "salida",
        fecha: ts(2026, 10, 7),
        createdAt: ts(2026, 10, 7),
      },
    ],
    entregas: [
      {
        id: "d1",
        reintegroId: "r1",
        monto: 100,
        fechaPago: ts(2026, 10, 20),
        realizadoPorUid: OTRO,
      },
    ],
  };
}

function balanceOctubre() {
  return calcularBalanceDelMes({
    mes: "2026-10",
    uid: UID,
    datos: datos(),
    ahora: AHORA,
  });
}

test("D-01 — ingresos por tipo suman el contrato (UYU/USD)", () => {
  const balance = balanceOctubre();
  const filas = detalleIngresos({
    ingresos: datos().ingresos,
    rango: balance.rango,
  });

  const uyu = filas.reduce((acc, fila) => acc + fila.uyu, 0);
  const usd = filas.reduce((acc, fila) => acc + fila.usd, 0);

  assert.equal(uyu, balance.ingresos.uyu);
  assert.equal(usd, balance.ingresos.usd);
  assert.deepEqual(
    filas.map((fila) => fila.id),
    ["sueldo", "banda", "otros"],
  );
  assert.equal(filas[0].uyu, 1000);
  assert.equal(filas[0].usd, 800);
});

test("D-02 — egresos por sección: los cuatro componentes del contrato", () => {
  const balance = balanceOctubre();
  const filas = detalleEgresos(balance);

  assert.deepEqual(
    filas.map((fila) => fila.id),
    ["diarios", "compartidosDiarios", "fijosPersonales", "fijosCompartidos"],
  );
  assert.equal(filas[0].monto, balance.egresos.diarios);
  assert.equal(filas[1].monto, balance.egresos.compartidosDiarios);
  assert.equal(filas[2].monto, balance.egresos.fijosPersonales);
  assert.equal(filas[3].monto, balance.egresos.fijosCompartidos);
  assert.equal(
    filas.reduce((acc, fila) => acc + fila.monto, 0),
    balance.egresos.total,
  );
});

test("D-03 — reintegros: entradas, salidas y neto", () => {
  const balance = balanceOctubre();
  const filas = detalleReintegros(balance);

  assert.deepEqual(
    filas.map((fila) => [fila.id, fila.monto]),
    [
      ["entradas", balance.reintegros.entradas],
      ["salidas", balance.reintegros.salidas],
      ["neto", balance.reintegros.neto],
    ],
  );
  assert.equal(balance.reintegros.entradas, 100);
  assert.equal(balance.reintegros.salidas, 300);
  assert.equal(balance.reintegros.neto, -200);
});

test("D-04 — mes vacío: sin filas de ingresos y secciones en cero", () => {
  const balance = calcularBalanceDelMes({
    mes: "2026-10",
    uid: UID,
    datos: {
      gastos: [],
      fixedEntries: [],
      ingresos: [],
      obligaciones: [],
      entregas: [],
    },
    ahora: AHORA,
  });

  assert.deepEqual(
    detalleIngresos({ ingresos: [], rango: balance.rango }),
    [],
  );
  assert.ok(
    detalleEgresos(balance).every((fila) => fila.monto === 0),
  );
  assert.ok(
    detalleReintegros(balance).every((fila) => fila.monto === 0),
  );
});
