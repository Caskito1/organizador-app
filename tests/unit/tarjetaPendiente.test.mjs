// tests/unit/tarjetaPendiente.test.mjs
// 6.2-bis — factura pendiente (sin emulador). Protege la regla del 27/11/2026:
//   pendiente = ciclo ESTRICTAMENTE anterior al actual, con datos (compra o
//   apertura) y estado != pagada; sin datos nunca; el actual nunca; se resuelve
//   del más viejo al más nuevo. También los guards de ciclo/compra bloqueados.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  cicloBloqueado,
  cicloPendiente,
  ciclosConDatos,
  compraBloqueada,
  hayPendiente,
} from "../../app/tarjetas/helpers/pendiente.js";

function d(anio, mes1, dia) {
  return new Date(anio, mes1 - 1, dia);
}

function compra({ monto = 10000, cuotasTotal = 1, fecha, tipo = "personal" }) {
  return { monto, cuotasTotal, fecha, tipo, moneda: "UYU", detalle: "" };
}

function plan({ desdeCiclo = "2026-10", cuotasTotal = 12 } = {}) {
  return {
    descripcion: "opencodeGo",
    moneda: "UYU",
    montoCuota: 5000,
    cuotasTotal,
    desdeCiclo,
  };
}

const OCA = { diaCierre: 18, diaVencimiento: 30 };
const ACTUAL = "2026-12";

function base(over = {}) {
  return {
    compras: [],
    apertura: [],
    ciclos: {},
    cicloActual: ACTUAL,
    ...OCA,
    ...over,
  };
}

test("U1 — sin datos en ciclos anteriores: no hay pendiente", () => {
  const data = base({ compras: [compra({ fecha: d(2026, 12, 10) })] });
  assert.equal(cicloPendiente(data), null);
  assert.equal(hayPendiente(data), false);
});

test("U2 — ciclo pasado con datos y por_pagar: es pendiente", () => {
  const data = base({
    compras: [compra({ fecha: d(2026, 10, 10) })],
    ciclos: { "2026-10": { estado: "por_pagar" } },
  });
  assert.equal(cicloPendiente(data), "2026-10");
});

test("U3 — ciclo pasado SIN datos: nunca es pendiente (aunque tenga estado)", () => {
  const data = base({
    compras: [compra({ fecha: d(2026, 12, 10) })],
    ciclos: { "2026-10": { estado: "por_pagar" } },
  });
  assert.equal(cicloPendiente(data), null);
});

test("U4 — ciclo pasado pagada: no es pendiente", () => {
  const data = base({
    compras: [compra({ fecha: d(2026, 10, 10) })],
    ciclos: { "2026-10": { estado: "pagada" } },
  });
  assert.equal(cicloPendiente(data), null);
});

test("U5 — dos pendientes: devuelve el más viejo", () => {
  const data = base({
    compras: [
      compra({ fecha: d(2026, 10, 10) }),
      compra({ fecha: d(2026, 11, 10) }),
    ],
  });
  assert.equal(cicloPendiente(data), "2026-10");

  const data2 = base({
    compras: [
      compra({ fecha: d(2026, 10, 10) }),
      compra({ fecha: d(2026, 11, 10) }),
    ],
    ciclos: { "2026-10": { estado: "pagada" } },
  });
  assert.equal(cicloPendiente(data2), "2026-11");
});

test("U6 — una cuota de apertura también da 'datos'", () => {
  const data = base({ apertura: [plan({ desdeCiclo: "2026-10" })] });
  assert.equal(cicloPendiente(data), "2026-10");
});

test("U7 — compra en cuotas: cuenta cada ciclo de sus cuotas", () => {
  // Compra 10/09 en 3 cuotas → 2026-09, 2026-10 y 2026-11.
  const data = base({
    compras: [compra({ fecha: d(2026, 9, 10), cuotasTotal: 3 })],
    ciclos: {
      "2026-09": { estado: "pagada" },
      "2026-10": { estado: "pagada" },
    },
  });
  assert.equal(cicloPendiente(data), "2026-11");

  const conDatos = ciclosConDatos({
    compras: [compra({ fecha: d(2026, 9, 10), cuotasTotal: 3 })],
    apertura: [],
    ...OCA,
  });
  assert.deepEqual([...conDatos].sort(), ["2026-09", "2026-10", "2026-11"]);
});

test("U8 — el ciclo actual nunca es pendiente (aunque esté por_pagar)", () => {
  const data = base({
    compras: [compra({ fecha: d(2026, 12, 10) })],
    ciclos: { "2026-12": { estado: "por_pagar" } },
  });
  assert.equal(cicloPendiente(data), null);
});

test("U9 — hayPendiente refleja cicloPendiente", () => {
  assert.equal(
    hayPendiente(base({ compras: [compra({ fecha: d(2026, 10, 10) })] })),
    true,
  );
  assert.equal(hayPendiente(base()), false);
});

test("U10 — tolerante: vacío, sin cicloActual o datos nulos", () => {
  assert.equal(cicloPendiente(), null);
  assert.equal(cicloPendiente({ cicloActual: null }), null);
  assert.equal(
    cicloPendiente({ compras: null, apertura: undefined, cicloActual: ACTUAL, ...OCA }),
    null,
  );
});

test("U11 — cicloBloqueado: solo los posteriores al pendiente", () => {
  const data = base({
    compras: [compra({ fecha: d(2026, 10, 10) })],
  });
  assert.equal(cicloBloqueado({ ...data, cicloKey: "2026-11" }), true);
  assert.equal(cicloBloqueado({ ...data, cicloKey: "2026-12" }), true);
  assert.equal(cicloBloqueado({ ...data, cicloKey: "2026-10" }), false);
  assert.equal(cicloBloqueado({ ...data, cicloKey: "2026-09" }), false);
});

test("U12 — compraBloqueada: una compra con cuotas futuras queda bloqueada", () => {
  const data = base({
    compras: [compra({ fecha: d(2026, 10, 10) })],
  });
  // 1 cuota en el pendiente: no bloquea.
  assert.equal(
    compraBloqueada({ ...data, compra: compra({ fecha: d(2026, 10, 10) }) }),
    false,
  );
  // 3 cuotas desde octubre: toca 11 y 12 (posteriores) → bloquea.
  assert.equal(
    compraBloqueada({
      ...data,
      compra: compra({ fecha: d(2026, 10, 10), cuotasTotal: 3 }),
    }),
    true,
  );
  // Sin pendiente: nada bloqueado.
  assert.equal(
    compraBloqueada({
      ...base(),
      compra: compra({ fecha: d(2026, 12, 10), cuotasTotal: 3 }),
    }),
    false,
  );
});
