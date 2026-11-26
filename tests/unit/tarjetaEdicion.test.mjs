// tests/unit/tarjetaEdicion.test.mjs
// 6.2 — reglas de edición (sin emulador). Protege PROPUESTA-ETAPA-6.md §12.6
// y la decisión A-5: compras nuevas (cuota 1/n, ciclo sin verificar); apertura
// editable solo mientras ninguna cuota cayó en un ciclo pagado/consolidado.

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

test("esCompraEditable: solo cuota 1/n en ciclo sin verificar", () => {
  assert.equal(
    esCompraEditable(compra, { cicloKey: "2026-10", estado: "sin_verificar", ...OCA }),
    true,
  );
  // Cuota 2/6 → no editable.
  assert.equal(
    esCompraEditable(compra, { cicloKey: "2026-11", estado: "sin_verificar", ...OCA }),
    false,
  );
  // Ciclo consolidado → no editable aunque sea cuota 1.
  assert.equal(
    esCompraEditable(compra, { cicloKey: "2026-10", estado: "por_pagar", ...OCA }),
    false,
  );
  // Fuera de la vida útil → no editable.
  assert.equal(
    esCompraEditable(compra, { cicloKey: "2027-04", estado: "sin_verificar", ...OCA }),
    false,
  );
});

test("esAperturaEditable: true si ningún ciclo de su rango está consolidado/pagado", () => {
  const plan = {
    descripcion: "opencodeGo",
    moneda: "UYU",
    montoCuota: 5000,
    cuotasTotal: 12,
    desdeCiclo: "2026-10",
  };

  assert.equal(esAperturaEditable(plan, { ciclos: {} }), true);
  // Un ciclo FUTURO del rango sin verificar no bloquea.
  assert.equal(
    esAperturaEditable(plan, { ciclos: { "2027-05": { estado: "sin_verificar" } } }),
    true,
  );
  // Un ciclo del rango consolidado bloquea.
  assert.equal(
    esAperturaEditable(plan, { ciclos: { "2026-10": { estado: "por_pagar" } } }),
    false,
  );
  assert.equal(
    esAperturaEditable(plan, { ciclos: { "2026-11": { estado: "pagada" } } }),
    false,
  );
  // Un ciclo fuera del rango no bloquea.
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
