// tests/unit/tarjetaEdicion.test.mjs
// 6.2 — reglas de edición (sin emulador). Protege PROPUESTA-ETAPA-6.md §12.6:
// compras editables solo si son nuevas (cuota 1/n), del ciclo ACTUAL y con el
// ciclo sin verificar. La apertura (A-5) queda para 6.4.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  esCompraEditable,
  esAperturaEditable,
  cuotasAperturaEnCiclosCerrados,
} from "../../app/tarjetas/helpers/edicion.js";

function d(anio, mes1, dia) {
  return new Date(anio, mes1 - 1, dia);
}

const OCA = { diaCierre: 18, diaVencimiento: 30 };

const compra = {
  monto: 108000,
  cuotasTotal: 6,
  fecha: d(2026, 10, 10),
};

test("esCompraEditable: solo cuota 1/n, ciclo actual y sin verificar", () => {
  // Ciclo actual, cuota 1/6, sin verificar → editable.
  assert.equal(
    esCompraEditable(compra, {
      cicloKey: "2026-10",
      cicloActual: "2026-10",
      estado: "sin_verificar",
      ...OCA,
    }),
    true,
  );

  // Ciclo pasado (cuota 1/6 pero ya no es el actual) → NO editable.
  assert.equal(
    esCompraEditable(compra, {
      cicloKey: "2026-10",
      cicloActual: "2026-11",
      estado: "sin_verificar",
      ...OCA,
    }),
    false,
  );

  // Cuota 2/6 → NO editable.
  assert.equal(
    esCompraEditable(compra, {
      cicloKey: "2026-11",
      cicloActual: "2026-11",
      estado: "sin_verificar",
      ...OCA,
    }),
    false,
  );

  // Ciclo consolidado → NO editable.
  assert.equal(
    esCompraEditable(compra, {
      cicloKey: "2026-10",
      cicloActual: "2026-10",
      estado: "por_pagar",
      ...OCA,
    }),
    false,
  );

  // Fuera de la vida útil → NO editable.
  assert.equal(
    esCompraEditable(compra, {
      cicloKey: "2027-04",
      cicloActual: "2027-04",
      estado: "sin_verificar",
      ...OCA,
    }),
    false,
  );

  // Sin cicloActual → NO editable.
  assert.equal(
    esCompraEditable(compra, {
      cicloKey: "2026-10",
      estado: "sin_verificar",
      ...OCA,
    }),
    false,
  );
});

test("esAperturaEditable (6.4): true si ningún ciclo de su rango está consolidado/pagado", () => {
  const plan = {
    descripcion: "opencodeGo",
    moneda: "UYU",
    montoCuota: 5000,
    cuotasTotal: 12,
    desdeCiclo: "2026-10",
  };

  assert.equal(esAperturaEditable(plan, { ciclos: {} }), true);
  assert.equal(
    esAperturaEditable(plan, { ciclos: { "2027-05": { estado: "sin_verificar" } } }),
    true,
  );
  assert.equal(
    esAperturaEditable(plan, { ciclos: { "2026-10": { estado: "por_pagar" } } }),
    false,
  );
  assert.equal(
    esAperturaEditable(plan, { ciclos: { "2026-11": { estado: "pagada" } } }),
    false,
  );
  assert.equal(
    esAperturaEditable(plan, { ciclos: { "2026-09": { estado: "pagada" } } }),
    true,
  );
});

test("esAperturaEditable: false sin desdeCiclo", () => {
  assert.equal(esAperturaEditable({ cuotasTotal: 12 }, { ciclos: {} }), false);
  assert.equal(esAperturaEditable(null, { ciclos: {} }), false);
});

test("cuotasAperturaEnCiclosCerrados: cuenta las cuotas del rango ya cerradas", () => {
  const plan = {
    descripcion: "opencodeGo",
    moneda: "UYU",
    montoCuota: 5000,
    cuotasTotal: 12,
    desdeCiclo: "2026-10",
  };

  assert.equal(cuotasAperturaEnCiclosCerrados(plan, { ciclos: {} }), 0);
  assert.equal(
    cuotasAperturaEnCiclosCerrados(plan, {
      ciclos: {
        "2026-10": { estado: "por_pagar" },
        "2026-11": { estado: "pagada" },
      },
    }),
    2,
  );
});
