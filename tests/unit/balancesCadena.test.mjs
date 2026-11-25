// tests/unit/balancesCadena.test.mjs
// 5.2 — cadena de saldos y tendencia (sin emulador).
// Protege las reglas de PROPUESTA-ETAPA-5.md §5.2.4: arrastre, ancla, huecos,
// mes en curso, cierre real y métricas de los tres gráficos.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MESES_TENDENCIA,
  PRIMER_MES_CONFIABLE,
  construirFilas,
  estadoTendencia,
  filasConCierre,
  filasDesdePrimerDato,
  filtrarTendencia,
  hayActividad,
  mesISO,
  metricasTendencia,
  netoInversiones,
  normalizarMeses,
  sumarMeses,
  ventanaMeses,
} from "../../app/balances/helpers/cadenaSaldos.js";

const AHORA = new Date(2026, 11, 10, 12); // 10/12/2026

function balance({
  uyu = 0,
  usd = 0,
  egresos = 0,
  entradas = 0,
  salidas = 0,
  inversiones = 0,
  movimiento,
} = {}) {
  const resultado = uyu - egresos;
  const neto = entradas - salidas;

  return {
    ingresos: { uyu, usd },
    egresos: { total: egresos },
    reintegros: { entradas, salidas, neto },
    resultado,
    inversiones,
    movimientoEsperado: movimiento ?? resultado + neto + inversiones,
  };
}

function filaDe({ mes = "2026-10", prefs = {}, balances = {}, ahora = AHORA } = {}) {
  const [fila] = construirFilas({
    meses: [mes],
    balancesPorMes: { [mes]: balances[mes] ?? balance() },
    preferencias: { meses: prefs },
    ahora,
  });

  return fila;
}

test("C-01 — mesISO, sumarMeses y ventana de 5 (cruce de año y orden)", () => {
  assert.equal(mesISO(new Date(2026, 9, 5)), "2026-10");
  assert.equal(sumarMeses("2026-01", -1), "2025-12");
  assert.equal(sumarMeses("2026-12", 1), "2027-01");

  assert.equal(MESES_TENDENCIA, 5);

  const ventana = ventanaMeses("2026-11", MESES_TENDENCIA);

  assert.equal(ventana.length, 5);
  assert.equal(ventana[0], "2026-07");
  assert.equal(ventana[4], "2026-11");

  assert.deepEqual(ventanaMeses("2026-01", MESES_TENDENCIA), [
    "2025-09",
    "2025-10",
    "2025-11",
    "2025-12",
    "2026-01",
  ]);
});

test("C-02 — normalizarMeses: vacío/tipos inválidos se ignoran", () => {
  assert.deepEqual(normalizarMeses(null), {});
  assert.deepEqual(normalizarMeses({ meses: null }), {});
  assert.deepEqual(
    normalizarMeses({
      meses: {
        "2026-10": {
          inversiones: { aportes: 1000, rescates: 500 },
          cajaAlInicio: 300,
          cajaRealAlCierre: 1200,
        },
      },
    }),
    {
      "2026-10": {
        inversiones: { aportes: 1000, rescates: 500 },
        cajaAlInicio: 300,
        cajaRealAlCierre: 1200,
      },
    },
  );

  const sucio = normalizarMeses({
    meses: {
      "2026-13": { cajaAlInicio: 1 },
      "2026-10": {
        inversiones: { aportes: -5, rescates: "x" },
        cajaAlInicio: 1.5,
        cajaRealAlCierre: "abc",
      },
      "2026-11": { inversiones: { aportes: 100 } },
    },
  });

  assert.deepEqual(sucio, {
    "2026-11": { inversiones: { aportes: 100, rescates: 0 } },
  });
});

test("C-03 — netoInversiones: neto, ceros y ausente", () => {
  assert.equal(
    netoInversiones({ inversiones: { aportes: 2000, rescates: 500 } }),
    -1500,
  );
  assert.equal(netoInversiones({ inversiones: { aportes: 0, rescates: 0 } }), 0);
  assert.equal(netoInversiones({}), 0);
  assert.equal(netoInversiones(null), 0);
});

test("C-04 — inicio por cierre anterior (prioridad sobre el ancla)", () => {
  const fila = filaDe({
    prefs: {
      "2026-09": { cajaRealAlCierre: 5000 },
      "2026-10": { cajaAlInicio: 999 },
    },
  });

  assert.equal(fila.cajaAlInicio, 5000);
  assert.equal(fila.origenInicio, "arrastre");
});

test("C-05 — inicio por ancla cuando no hay cierre anterior", () => {
  const fila = filaDe({
    prefs: { "2026-10": { cajaAlInicio: 500 } },
  });

  assert.equal(fila.cajaAlInicio, 500);
  assert.equal(fila.origenInicio, "ancla");
});

test("C-06 — sin cierre anterior ni ancla: sin inicio ni esperada", () => {
  const fila = filaDe({ balances: { "2026-10": balance({ movimiento: 100 }) } });

  assert.equal(fila.cajaAlInicio, null);
  assert.equal(fila.origenInicio, null);
  assert.equal(fila.cajaEsperadaAlCierre, null);
  assert.equal(fila.diferencia, null);
});

test("C-07 — mes salteado: no arrastra un cierre de dos meses atrás", () => {
  const conAncla = filaDe({
    prefs: {
      "2026-08": { cajaRealAlCierre: 1000 },
      "2026-10": { cajaAlInicio: 700 },
    },
  });

  assert.equal(conAncla.cajaAlInicio, 700);

  const sinAncla = filaDe({
    prefs: { "2026-08": { cajaRealAlCierre: 1000 } },
  });

  assert.equal(sinAncla.cajaAlInicio, null);
});

test("C-08 — esperada = inicio + movimiento", () => {
  const fila = filaDe({
    balances: { "2026-10": balance({ movimiento: 250 }) },
    prefs: { "2026-10": { cajaAlInicio: 1000 } },
  });

  assert.equal(fila.cajaEsperadaAlCierre, 1250);
});

test("C-09 — diferencia = esperada − real (o null sin real)", () => {
  const conCierre = filaDe({
    balances: { "2026-10": balance({ movimiento: 250 }) },
    prefs: {
      "2026-10": { cajaAlInicio: 1000, cajaRealAlCierre: 1200 },
    },
  });

  assert.equal(conCierre.cajaEsperadaAlCierre, 1250);
  assert.equal(conCierre.cajaRealAlCierre, 1200);
  assert.equal(conCierre.diferencia, 50);

  const sinCierre = filaDe({
    balances: { "2026-10": balance({ movimiento: 250 }) },
    prefs: { "2026-10": { cajaAlInicio: 1000 } },
  });

  assert.equal(sinCierre.cajaRealAlCierre, null);
  assert.equal(sinCierre.diferencia, null);
});

test("C-10 — mes en curso: el cierre real se ignora (P-5)", () => {
  const ahora = new Date(2026, 9, 15, 12);
  const fila = filaDe({
    ahora,
    balances: { "2026-10": balance({ movimiento: 100 }) },
    prefs: {
      "2026-10": { cajaAlInicio: 1000, cajaRealAlCierre: 2000 },
    },
  });

  assert.equal(fila.esEnCurso, true);
  assert.equal(fila.cajaEsperadaAlCierre, 1100);
  assert.equal(fila.cajaRealAlCierre, null);
  assert.equal(fila.diferencia, null);
});

test("C-11 — tendencia: arranca en el primer dato y dibuja ceros internos", () => {
  const filas = construirFilas({
    meses: ["2026-08", "2026-09", "2026-10"],
    balancesPorMes: {
      "2026-08": balance(),
      "2026-09": balance({ uyu: 100 }),
      "2026-10": balance(),
    },
    preferencias: { meses: {} },
    ahora: AHORA,
  });

  const dibujadas = filasDesdePrimerDato(filas);

  assert.deepEqual(
    dibujadas.map((fila) => fila.mes),
    ["2026-09", "2026-10"],
  );
});

test("C-12 — esperado vs real saltea meses sin cierre", () => {
  const filas = construirFilas({
    meses: ["2026-09", "2026-10"],
    balancesPorMes: {
      "2026-09": balance({ movimiento: 100 }),
      "2026-10": balance({ movimiento: 100 }),
    },
    preferencias: {
      meses: {
        "2026-09": { cajaAlInicio: 1000, cajaRealAlCierre: 1150 },
      },
    },
    ahora: AHORA,
  });

  assert.deepEqual(
    filasConCierre(filas).map((fila) => fila.mes),
    ["2026-09"],
  );
});

test("C-13 — métricas sobre la ventana dibujada (piso 2026-09)", () => {
  const filas = [
    {
      mes: "2026-08",
      balance: balance({ uyu: 999, egresos: 999, movimiento: 999 }),
      diferencia: 999,
    },
    {
      mes: "2026-09",
      balance: balance({ uyu: 100, egresos: 50, movimiento: 10 }),
      diferencia: 5,
    },
    {
      mes: "2026-10",
      balance: balance({ uyu: 200, egresos: 50, movimiento: 20 }),
      diferencia: -1,
    },
  ];

  const metricas = metricasTendencia(filtrarTendencia(filas));

  assert.equal(metricas.promedioIngresos, 150);
  assert.equal(metricas.promedioEgresos, 50);
  assert.equal(metricas.acumuladoMovimiento, 30);
  assert.equal(metricas.promedioGap, 2);
  assert.equal(metricas.mesesDibujados, 2);
  assert.equal(metricas.mesesConCierre, 2);
});

test("C-14 — ventana sin actividad: vacío y métricas neutras", () => {
  const filas = [
    { mes: "2026-09", balance: balance(), diferencia: null },
    { mes: "2026-10", balance: balance(), diferencia: null },
  ];

  assert.deepEqual(filasDesdePrimerDato(filas), []);

  const metricas = metricasTendencia(filas);

  assert.equal(metricas.promedioIngresos, null);
  assert.equal(metricas.promedioEgresos, null);
  assert.equal(metricas.acumuladoMovimiento, 0);
  assert.equal(metricas.promedioGap, null);
  assert.equal(metricas.mesesDibujados, 0);
});

test("C-15 — tendencia: piso 2026-09 y ventana de 5", () => {
  const filas = [
    { mes: "2026-07", balance: balance({ uyu: 100 }) },
    { mes: "2026-08", balance: balance() },
    { mes: "2026-09", balance: balance({ uyu: 100 }) },
    { mes: "2026-10", balance: balance() },
    { mes: "2026-11", balance: balance() },
  ];

  assert.equal(PRIMER_MES_CONFIABLE, "2026-09");
  assert.deepEqual(
    filtrarTendencia(filas).map((fila) => fila.mes),
    ["2026-09", "2026-10", "2026-11"],
  );
  assert.equal(hayActividad(filas), true);
  assert.equal(estadoTendencia(filas), "ok");
});

test("C-16 — tendencia sin actividad: «sin datos»", () => {
  const filas = [
    { mes: "2026-09", balance: balance(), diferencia: null },
    { mes: "2026-10", balance: balance(), diferencia: null },
  ];

  assert.equal(hayActividad(filas), false);
  assert.equal(estadoTendencia(filas), "sin-datos");
  assert.deepEqual(filasDesdePrimerDato(filtrarTendencia(filas)), []);
});

test("C-17 — actividad solo antes del piso: «sin meses confiables»", () => {
  const filas = [
    { mes: "2026-07", balance: balance({ uyu: 100 }), diferencia: null },
    { mes: "2026-08", balance: balance(), diferencia: null },
    { mes: "2026-09", balance: balance(), diferencia: null },
  ];

  assert.equal(hayActividad(filas), true);
  assert.equal(estadoTendencia(filas), "sin-confiables");
  assert.deepEqual(
    filtrarTendencia(filas).map((fila) => fila.mes),
    ["2026-09"],
  );
  assert.deepEqual(filasDesdePrimerDato(filtrarTendencia(filas)), []);
});
