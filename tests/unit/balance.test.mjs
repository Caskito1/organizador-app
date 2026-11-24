// tests/unit/balance.test.mjs
// 5.1 — núcleo puro del balance consolidado (sin emulador).
// Protege el contrato de PROPUESTA-ETAPA-5.md §5.1.5/§5.1.6: rango
// semiabierto, fallbacks legacy, egresos de /gastos, los cuatro casos de caja,
// condonaciones (memo + stock, sin movimiento), stock al corte, inversiones y
// la identidad `movimientoEsperado = resultado + neto + inversiones`.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  calcularBalanceDelMes,
  rangoDelMes,
} from "../../app/balance/helpers/balance.js";

// Timestamp mínimo (duck-typing de toDate), sin cargar el SDK.
function ts(anio, mes, dia, hora = 0, minuto = 0, segundo = 0, ms = 0) {
  return {
    toDate: () => new Date(anio, mes - 1, dia, hora, minuto, segundo, ms),
  };
}

const UID = "uid_a";
const OTRO = "uid_b";

function datos(over = {}) {
  return {
    gastos: [],
    fixedEntries: [],
    ingresos: [],
    obligaciones: [],
    entregas: [],
    ...over,
  };
}

function calcular({
  mes = "2026-10",
  uid = UID,
  data = datos(),
  ahora = new Date(2026, 11, 10, 12),
  inversiones,
} = {}) {
  return calcularBalanceDelMes({ mes, uid, datos: data, ahora, inversiones });
}

function gasto(over = {}) {
  return {
    id: "g1",
    usuario: UID,
    tipo: "personal",
    monto: 1000,
    fecha: ts(2026, 10, 5),
    createdAt: ts(2026, 10, 5),
    ...over,
  };
}

function ingreso(over = {}) {
  return {
    id: "i1",
    usuario: UID,
    tipo: "sueldo",
    monto: 1000,
    moneda: "UYU",
    fecha: ts(2026, 10, 2),
    createdAt: ts(2026, 10, 2),
    ...over,
  };
}

function entry(over = {}) {
  return {
    id: "e1",
    usuario: UID,
    periodo: "2026-10",
    montoTotal: 1000,
    paidByUid: UID,
    ...over,
  };
}

function obl(over = {}) {
  return {
    id: "r1",
    registradoPor: UID,
    participantes: [UID, OTRO],
    sentido: "por_cobrar",
    monto: 1000,
    devuelto: 0,
    movimientoInicial: "ninguno",
    fecha: ts(2026, 10, 3),
    createdAt: ts(2026, 10, 3),
    ...over,
  };
}

function entrega(over = {}) {
  return {
    id: "d1",
    reintegroId: "r1",
    monto: 500,
    fechaPago: ts(2026, 10, 20),
    realizadoPorUid: OTRO,
    ...over,
  };
}

const CORTE_OCTUBRE = new Date(2026, 9, 31, 23, 59, 59, 999);

test("B-U01 — mes vacío: ceros, corte del mes cerrado y sin campos de saldo", () => {
  const b = calcular({ data: datos() });

  assert.equal(b.mes, "2026-10");
  assert.deepEqual(b.ingresos, { uyu: 0, usd: 0 });
  assert.deepEqual(b.egresos, {
    total: 0,
    diarios: 0,
    compartidosDiarios: 0,
    fijosPersonales: 0,
    fijosCompartidos: 0,
  });
  assert.equal(b.resultado, 0);
  assert.deepEqual(b.reintegros, { entradas: 0, salidas: 0, neto: 0 });
  assert.equal(b.inversiones, 0);
  assert.deepEqual(b.condonaciones, { ganadas: 0, perdidas: 0 });
  assert.equal(b.movimientoEsperado, 0);
  assert.deepEqual(b.stock, {
    pendienteCobro: 0,
    pendienteDevolucion: 0,
    corte: CORTE_OCTUBRE,
  });
  assert.ok(!("observado" in b));
  assert.ok(!("diferencia" in b));
  assert.ok(!("cajaEsperada" in b));

  assert.throws(
    () => calcularBalanceDelMes({ mes: "2026-10", uid: "", datos: datos() }),
    (error) => error.codigo === "UID_REQUERIDO",
  );
});

test("B-U02 — rangoDelMes: semiabierto local y mes inválido", () => {
  const { desde, hasta } = rangoDelMes("2026-10");

  assert.deepEqual(desde, new Date(2026, 9, 1));
  assert.deepEqual(hasta, new Date(2026, 10, 1));

  assert.throws(
    () => rangoDelMes("2026-13"),
    (error) => error.codigo === "MES_INVALIDO",
  );
  assert.throws(
    () => rangoDelMes("2026-10-01"),
    (error) => error.codigo === "MES_INVALIDO",
  );
  assert.throws(
    () => rangoDelMes(null),
    (error) => error.codigo === "MES_INVALIDO",
  );
});

test("B-U03 — bordes del rango: primer y último instante entran; el siguiente mes no", () => {
  const b = calcular({
    data: datos({
      gastos: [
        gasto({ id: "g1", monto: 100, fecha: ts(2026, 10, 1, 0, 0, 0, 0) }),
        gasto({ id: "g2", monto: 200, fecha: ts(2026, 10, 31, 23, 59, 59, 999) }),
        gasto({ id: "g3", monto: 400, fecha: ts(2026, 11, 1) }),
        gasto({ id: "g4", monto: 800, fecha: ts(2026, 9, 30, 23, 59, 59, 999) }),
      ],
    }),
  });

  assert.equal(b.egresos.diarios, 300);
});

test("B-U04 — fallback de fecha en gastos e ingresos (fecha manda; createdAt si falta)", () => {
  const b = calcular({
    data: datos({
      gastos: [
        gasto({ id: "g1", monto: 1000, fecha: undefined, createdAt: ts(2026, 10, 31) }),
        gasto({ id: "g2", monto: 1000, fecha: ts(2026, 10, 5), createdAt: ts(2026, 11, 2) }),
        gasto({ id: "g3", monto: 300, fecha: undefined, createdAt: ts(2026, 11, 1) }),
      ],
      ingresos: [
        ingreso({ monto: 15000, fecha: undefined, createdAt: ts(2026, 10, 15) }),
        ingreso({ id: "i2", monto: 500, fecha: ts(2026, 10, 10), createdAt: ts(2026, 11, 3) }),
      ],
    }),
  });

  assert.equal(b.egresos.diarios, 2000);
  assert.equal(b.ingresos.uyu, 15500);

  const noviembre = calcular({ mes: "2026-11", data: datos({ gastos: [
    gasto({ id: "g1", monto: 1000, fecha: undefined, createdAt: ts(2026, 10, 31) }),
    gasto({ id: "g2", monto: 1000, fecha: ts(2026, 10, 5), createdAt: ts(2026, 11, 2) }),
    gasto({ id: "g3", monto: 300, fecha: undefined, createdAt: ts(2026, 11, 1) }),
  ] }) });

  assert.equal(noviembre.egresos.diarios, 300);
});

test("B-U05 — fallback de fecha en obligación legacy (sin fecha)", () => {
  const b = calcular({
    data: datos({
      obligaciones: [
        obl({
          monto: 1000,
          movimientoInicial: "salida",
          fecha: undefined,
          createdAt: ts(2026, 10, 31),
        }),
      ],
    }),
  });

  assert.equal(b.reintegros.salidas, 1000);
  assert.equal(b.reintegros.neto, -1000);
  assert.equal(b.stock.pendienteCobro, 1000);
});

test("B-U06 — documento sin fecha ni createdAt: no entra a ningún mes", () => {
  const b = calcular({
    data: datos({
      gastos: [gasto({ fecha: undefined, createdAt: undefined })],
      ingresos: [ingreso({ fecha: undefined, createdAt: undefined })],
      obligaciones: [
        obl({ fecha: undefined, createdAt: undefined, movimientoInicial: "salida" }),
      ],
    }),
  });

  assert.equal(b.egresos.total, 0);
  assert.equal(b.ingresos.uyu, 0);
  assert.equal(b.reintegros.salidas, 0);
});

test("B-U07 — moneda: legacy sin moneda se lee UYU; el USD va aparte", () => {
  const b = calcular({
    data: datos({
      ingresos: [
        ingreso({ monto: 1000, moneda: undefined }),
        ingreso({ id: "i2", monto: 800, moneda: "USD", tipo: "sueldo", subtipo: "sueldo_dolares" }),
      ],
    }),
  });

  assert.equal(b.ingresos.uyu, 1000);
  assert.equal(b.ingresos.usd, 800);
  assert.equal(b.resultado, 1000);
  assert.equal(b.movimientoEsperado, 1000);
});

test("B-U08 — diarios: solo lo mío (personal + compartido pagado por mí)", () => {
  const b = calcular({
    data: datos({
      gastos: [
        gasto({ id: "g1", monto: 5000 }),
        gasto({ id: "g2", monto: 9000, usuario: OTRO }),
        gasto({ id: "g3", monto: 2000, tipo: "compartido", groupId: "g1" }),
        gasto({ id: "g4", monto: 800, tipo: "compartido", groupId: "g1", usuario: OTRO }),
      ],
    }),
  });

  assert.equal(b.egresos.diarios, 5000);
  assert.equal(b.egresos.compartidosDiarios, 2000);
});

test("B-U09 — fijos: 100 % personales y 50 % compartidos, solo pagados", () => {
  const b = calcular({
    data: datos({
      fixedEntries: [
        entry({ id: "e1", montoTotal: 1500 }),
        entry({ id: "e2", montoTotal: 300, paidByUid: null }),
        entry({ id: "e3", montoTotal: 4000, groupId: "g1" }),
        entry({ id: "e4", montoTotal: 1000, groupId: "g1", paidByUid: null }),
      ],
    }),
  });

  assert.equal(b.egresos.fijosPersonales, 1500);
  assert.equal(b.egresos.fijosCompartidos, 2000);
  assert.equal(b.egresos.total, 3500);
});

test("B-U10 — fijo anual cubierto por pagoHasta > periodo", () => {
  const b = calcular({
    data: datos({
      fixedEntries: [
        entry({
          montoTotal: 700,
          paidByUid: null,
          periodo: "2026-10",
          pagoHasta: "2026-12",
        }),
      ],
    }),
  });

  assert.equal(b.egresos.fijosPersonales, 700);
});

test("B-U11 — entry de otro período no suma", () => {
  const b = calcular({
    data: datos({
      fixedEntries: [entry({ montoTotal: 700, periodo: "2026-09" })],
    }),
  });

  assert.equal(b.egresos.total, 0);
});

test("B-U12 — ledger: total = Σ de los cuatro componentes (INV-1)", () => {
  const b = calcular({
    data: datos({
      gastos: [
        gasto({ id: "g1", monto: 5000 }),
        gasto({ id: "g2", monto: 2000, tipo: "compartido", groupId: "g1" }),
        gasto({ id: "g3", monto: 800, tipo: "compartido", groupId: "g1", usuario: OTRO }),
      ],
      fixedEntries: [
        entry({ id: "e1", montoTotal: 1500 }),
        entry({ id: "e2", montoTotal: 300, paidByUid: null }),
        entry({ id: "e3", montoTotal: 4000, groupId: "g1" }),
        entry({ id: "e4", montoTotal: 600, groupId: "g1", paidByUid: OTRO }),
        entry({ id: "e5", montoTotal: 1000, groupId: "g1", paidByUid: null }),
      ],
    }),
  });

  assert.equal(b.egresos.diarios, 5000);
  assert.equal(b.egresos.compartidosDiarios, 2000);
  assert.equal(b.egresos.fijosPersonales, 1500);
  assert.equal(b.egresos.fijosCompartidos, 2300);
  assert.equal(b.egresos.total, 10800);
  assert.equal(
    b.egresos.total,
    b.egresos.diarios +
      b.egresos.compartidosDiarios +
      b.egresos.fijosPersonales +
      b.egresos.fijosCompartidos,
  );
});

test("B-U13 — resultado = ingresos.uyu − egresos.total; el USD no entra", () => {
  const b = calcular({
    data: datos({
      ingresos: [ingreso({ monto: 10000 }), ingreso({ id: "i2", monto: 999, moneda: "USD" })],
      gastos: [gasto({ monto: 3000 })],
    }),
  });

  assert.equal(b.ingresos.uyu, 10000);
  assert.equal(b.ingresos.usd, 999);
  assert.equal(b.resultado, 7000);
  assert.equal(b.movimientoEsperado, 7000);
});

test("B-U14 — caja 1: préstamo dado en efectivo (salida)", () => {
  const b = calcular({
    data: datos({
      obligaciones: [obl({ monto: 3000, movimientoInicial: "salida" })],
    }),
  });

  assert.equal(b.reintegros.entradas, 0);
  assert.equal(b.reintegros.salidas, 3000);
  assert.equal(b.reintegros.neto, -3000);
  assert.equal(b.movimientoEsperado, -3000);
  assert.equal(b.stock.pendienteCobro, 3000);
});

test("B-U15 — caja 2: préstamo recibido en efectivo (entrada)", () => {
  const b = calcular({
    data: datos({
      obligaciones: [
        obl({ sentido: "por_devolver", monto: 3000, movimientoInicial: "entrada" }),
      ],
    }),
  });

  assert.equal(b.reintegros.entradas, 3000);
  assert.equal(b.reintegros.salidas, 0);
  assert.equal(b.reintegros.neto, 3000);
  assert.equal(b.movimientoEsperado, 3000);
  assert.equal(b.stock.pendienteDevolucion, 3000);
});

test("B-U16 — caja 3: «me compraron algo» (por_devolver + ninguno)", () => {
  const b = calcular({
    data: datos({
      obligaciones: [
        obl({ sentido: "por_devolver", monto: 3000, movimientoInicial: "ninguno" }),
      ],
    }),
  });

  assert.equal(b.reintegros.entradas, 0);
  assert.equal(b.reintegros.salidas, 0);
  assert.equal(b.reintegros.neto, 0);
  assert.equal(b.movimientoEsperado, 0);
  assert.equal(b.stock.pendienteDevolucion, 3000);
  assert.equal(b.stock.pendienteCobro, 0);
});

test("B-U17 — caja 4: el saldo de esa compra lo pago yo (salida, no cobro)", () => {
  const b = calcular({
    data: datos({
      obligaciones: [
        obl({
          id: "r6",
          sentido: "por_devolver",
          monto: 3000,
          devuelto: 3000,
          movimientoInicial: "ninguno",
          fecha: ts(2026, 9, 20),
          createdAt: ts(2026, 9, 20),
        }),
      ],
      entregas: [
        entrega({
          reintegroId: "r6",
          monto: 3000,
          fechaPago: ts(2026, 10, 10),
          realizadoPorUid: UID,
        }),
      ],
    }),
  });

  assert.equal(b.reintegros.entradas, 0);
  assert.equal(b.reintegros.salidas, 3000);
  assert.equal(b.reintegros.neto, -3000);
  assert.equal(b.movimientoEsperado, -3000);
  assert.equal(b.stock.pendienteDevolucion, 0);
  assert.equal(b.stock.pendienteCobro, 0);
});

test("B-U18 — condonación ganada: memo + stock, sin mover el movimiento", () => {
  const b = calcular({
    data: datos({
      obligaciones: [
        obl({
          sentido: "por_devolver",
          monto: 2000,
          condonacion: { condonadaPor: OTRO, createdAt: ts(2026, 10, 28) },
        }),
      ],
    }),
  });

  assert.deepEqual(b.condonaciones, { ganadas: 2000, perdidas: 0 });
  assert.equal(b.movimientoEsperado, 0);
  assert.equal(b.stock.pendienteDevolucion, 0);
  assert.equal(b.stock.pendienteCobro, 0);
});

test("B-U19 — condonación perdida: memo + stock, sin mover el movimiento", () => {
  const b = calcular({
    data: datos({
      obligaciones: [
        obl({
          monto: 2000,
          condonacion: { condonadaPor: UID, createdAt: ts(2026, 10, 28) },
        }),
      ],
    }),
  });

  assert.deepEqual(b.condonaciones, { ganadas: 0, perdidas: 2000 });
  assert.equal(b.movimientoEsperado, 0);
  assert.equal(b.stock.pendienteCobro, 0);
});

test("B-U20 — condonación posterior al corte: al corte sigue en el stock", () => {
  const data = datos({
    obligaciones: [
      obl({
        monto: 2000,
        condonacion: { condonadaPor: UID, createdAt: ts(2026, 11, 5) },
      }),
    ],
  });

  const octubre = calcular({ data });
  assert.deepEqual(octubre.condonaciones, { ganadas: 0, perdidas: 0 });
  assert.equal(octubre.stock.pendienteCobro, 2000);

  const noviembre = calcular({ mes: "2026-11", data });
  assert.deepEqual(noviembre.condonaciones, { ganadas: 0, perdidas: 2000 });
  assert.equal(noviembre.stock.pendienteCobro, 0);
});

test("B-U21 — stock al corte: el pago del mes siguiente no afecta el cierre", () => {
  const data = datos({
    obligaciones: [
      obl({ monto: 3000, devuelto: 1500, movimientoInicial: "salida" }),
    ],
    entregas: [
      entrega({ id: "d1", monto: 1000, fechaPago: ts(2026, 10, 20) }),
      entrega({ id: "d2", monto: 500, fechaPago: ts(2026, 11, 5) }),
    ],
  });

  const octubre = calcular({ data });
  assert.equal(octubre.reintegros.entradas, 1000);
  assert.equal(octubre.stock.pendienteCobro, 2000);
  assert.equal(octubre.movimientoEsperado, -2000);

  const noviembre = calcular({ mes: "2026-11", data });
  assert.equal(noviembre.reintegros.entradas, 500);
  assert.equal(noviembre.stock.pendienteCobro, 1500);
});

test("B-U22 — eliminada no resucita; mes en curso y futuro usan corte = ahora", () => {
  const eliminada = calcular({
    data: datos({
      obligaciones: [
        obl({ monto: 5000, eliminacion: { motivo: null } }),
      ],
    }),
  });

  assert.equal(eliminada.stock.pendienteCobro, 0);
  assert.equal(eliminada.reintegros.salidas, 0);
  assert.equal(eliminada.reintegros.entradas, 0);

  const ahora = new Date(2026, 9, 15, 12, 0, 0);
  const enCurso = calcular({
    ahora,
    data: datos({
      obligaciones: [
        obl({ monto: 2000, devuelto: 1000, movimientoInicial: "salida" }),
      ],
      entregas: [
        entrega({ id: "d1", monto: 500, fechaPago: ts(2026, 10, 15, 10) }),
        entrega({ id: "d2", monto: 500, fechaPago: ts(2026, 10, 16, 10) }),
      ],
    }),
  });

  assert.deepEqual(enCurso.stock.corte, ahora);
  assert.equal(enCurso.stock.pendienteCobro, 1500);

  const futuro = calcularBalanceDelMes({
    mes: "2026-12",
    uid: UID,
    datos: datos(),
    ahora,
  });

  assert.deepEqual(futuro.stock.corte, ahora);
});

test("B-U23 — inversiones: aporte negativo baja el movimiento, no el resultado", () => {
  const base = calcular({ data: datos({ ingresos: [ingreso({ monto: 10000 })] }) });
  const conAporte = calcular({
    data: datos({ ingresos: [ingreso({ monto: 10000 })] }),
    inversiones: -2000,
  });

  assert.equal(conAporte.inversiones, -2000);
  assert.equal(conAporte.resultado, base.resultado);
  assert.equal(conAporte.egresos.total, base.egresos.total);
  assert.equal(conAporte.movimientoEsperado, base.movimientoEsperado - 2000);
});

test("B-U24 — inversiones: rescate positivo sube el movimiento", () => {
  const base = calcular({ data: datos({ ingresos: [ingreso({ monto: 10000 })] }) });
  const conRescate = calcular({
    data: datos({ ingresos: [ingreso({ monto: 10000 })] }),
    inversiones: 1500,
  });

  assert.equal(conRescate.inversiones, 1500);
  assert.equal(conRescate.resultado, base.resultado);
  assert.equal(conRescate.movimientoEsperado, base.movimientoEsperado + 1500);
});

test("B-U25 — inversiones ausente = 0; valor inválido rechazado", () => {
  const indefinida = calcular({ data: datos({ ingresos: [ingreso({ monto: 5000 })] }) });
  const nula = calcular({
    data: datos({ ingresos: [ingreso({ monto: 5000 })] }),
    inversiones: null,
  });

  assert.equal(indefinida.inversiones, 0);
  assert.equal(indefinida.movimientoEsperado, 5000);
  assert.equal(nula.inversiones, 0);
  assert.equal(nula.movimientoEsperado, 5000);

  assert.throws(
    () => calcular({ inversiones: "x" }),
    (error) => error.codigo === "INVERSIONES_INVALIDAS",
  );
  assert.throws(
    () => calcular({ inversiones: {} }),
    (error) => error.codigo === "INVERSIONES_INVALIDAS",
  );
  assert.throws(
    () => calcular({ inversiones: Number.NaN }),
    (error) => error.codigo === "INVERSIONES_INVALIDAS",
  );
});

test("B-U26 — identidad con signos mixtos (INV-3/INV-5)", () => {
  const b = calcular({
    data: datos({
      ingresos: [ingreso({ monto: 1000 })],
      gastos: [gasto({ monto: 5000 })],
      obligaciones: [obl({ monto: 1000, movimientoInicial: "entrada" })],
    }),
    inversiones: -500,
  });

  assert.equal(b.resultado, -4000);
  assert.deepEqual(b.reintegros, { entradas: 1000, salidas: 0, neto: 1000 });
  assert.equal(b.reintegros.neto, b.reintegros.entradas - b.reintegros.salidas);
  assert.equal(
    b.movimientoEsperado,
    b.resultado + b.reintegros.neto + b.inversiones,
  );
  assert.equal(b.movimientoEsperado, -3500);
});
