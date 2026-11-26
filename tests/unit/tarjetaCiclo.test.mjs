// tests/unit/tarjetaCiclo.test.mjs
// 6.0 — ciclo de la tarjeta (sin emulador). Protege PROPUESTA-ETAPA-6.md §10.4:
// rango semiabierto, día de cierre incluido / día siguiente afuera, cruce de
// año y la derivación del mes de vencimiento (enmienda ii).

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  cicloDeFecha,
  sumarCiclos,
  ciclosEntre,
  rangoCiclo,
  fechaEnCiclo,
  vencimientoDeCiclo,
  etiquetaCiclo,
  esCicloValido,
} from "../../app/tarjetas/helpers/ciclo.js";

// En Uruguay el "18" es 18 del mes local; new Date(y, m0, d) usa mes 0-based.
function d(anio, mes1, dia) {
  return new Date(anio, mes1 - 1, dia);
}

test("cicloDeFecha: día de cierre incluido, día siguiente abre el próximo", () => {
  assert.equal(cicloDeFecha(d(2026, 11, 18), 18, 30), "2026-11");
  assert.equal(cicloDeFecha(d(2026, 11, 19), 18, 30), "2026-12");
  assert.equal(cicloDeFecha(d(2026, 12, 18), 18, 30), "2026-12");
  assert.equal(cicloDeFecha(d(2026, 12, 19), 18, 30), "2027-01");
  assert.equal(cicloDeFecha(d(2027, 1, 19), 18, 30), "2027-02");
});

test("cicloDeFecha: sin diaVencimiento asume mismo mes (OCA)", () => {
  assert.equal(cicloDeFecha(d(2026, 11, 18), 18), "2026-11");
  assert.equal(cicloDeFecha(d(2026, 11, 19), 18), "2026-12");
});

test("cicloDeFecha: vencimiento <= cierre cae el mes siguiente (enmienda ii)", () => {
  // Cierre 25, vencimiento 10: una compra del 26/11 cierra en diciembre y
  // vence en enero.
  assert.equal(cicloDeFecha(d(2026, 11, 26), 25, 10), "2027-01");
  // Una compra del 25/11 todavía cierra en noviembre (día de cierre incluido).
  assert.equal(cicloDeFecha(d(2026, 11, 25), 25, 10), "2026-12");
});

test("rangoCiclo: semiabierto [19/11, 19/12) para 2026-12", () => {
  const r = rangoCiclo("2026-12", 18, 30);
  assert.equal(r.desde.getTime(), d(2026, 11, 19).getTime());
  assert.equal(r.hasta.getTime(), d(2026, 12, 19).getTime());
});

test("fechaEnCiclo: bordes exactos", () => {
  const fin = new Date(2026, 11, 18, 23, 59, 59);
  const abre = d(2026, 12, 19);
  assert.equal(fechaEnCiclo(fin, "2026-12", 18, 30), true);
  assert.equal(fechaEnCiclo(abre, "2026-12", 18, 30), false);
  assert.equal(fechaEnCiclo(d(2026, 11, 19), "2026-12", 18, 30), true);
  assert.equal(
    fechaEnCiclo(new Date(2026, 10, 18, 23, 59, 59), "2026-12", 18, 30),
    false,
  );
});

test("rangoCiclo: cruce de año hacia adelante y hacia atrás", () => {
  const enero = rangoCiclo("2027-01", 18, 30);
  assert.equal(enero.desde.getTime(), d(2026, 12, 19).getTime());
  assert.equal(enero.hasta.getTime(), d(2027, 1, 19).getTime());

  const enero2026 = rangoCiclo("2026-01", 18, 30);
  assert.equal(enero2026.desde.getTime(), d(2025, 12, 19).getTime());
  assert.equal(enero2026.hasta.getTime(), d(2026, 1, 19).getTime());
});

test("rangoCiclo: si el vencimiento cae el mes siguiente, el rango usa el cierre", () => {
  // Cierre 25, vencimiento 10; ciclo "2027-01" = compras [26/11/2026, 26/12/2026).
  const r = rangoCiclo("2027-01", 25, 10);
  assert.equal(r.desde.getTime(), d(2026, 11, 26).getTime());
  assert.equal(r.hasta.getTime(), d(2026, 12, 26).getTime());
});

test("ciclosEntre: diferencia de meses, con signo", () => {
  assert.equal(ciclosEntre("2026-10", "2026-12"), 2);
  assert.equal(ciclosEntre("2026-12", "2027-02"), 2);
  assert.equal(ciclosEntre("2026-12", "2026-12"), 0);
  assert.equal(ciclosEntre("2026-12", "2026-10"), -2);
});

test("sumarCiclos: cruza año en ambos sentidos", () => {
  assert.equal(sumarCiclos("2026-12", 1), "2027-01");
  assert.equal(sumarCiclos("2026-01", -1), "2025-12");
  assert.equal(sumarCiclos("2026-12", 0), "2026-12");
});

test("esCicloValido: exige YYYY-MM canónico", () => {
  assert.equal(esCicloValido("2026-12"), true);
  assert.equal(esCicloValido("2026-13"), false);
  assert.equal(esCicloValido("2026-00"), false);
  assert.equal(esCicloValido("2026-1"), false);
});

test("vencimientoDeCiclo: día del vencimiento en el mes del ciclo", () => {
  const v = vencimientoDeCiclo("2026-12", 30);
  assert.equal(v.getFullYear(), 2026);
  assert.equal(v.getMonth(), 11);
  assert.equal(v.getDate(), 30);
});

test("etiquetaCiclo: MM/YYYY", () => {
  assert.equal(etiquetaCiclo("2026-12"), "12/2026");
});
