// tests/unit/tarjetaApertura.test.mjs
// 6.0 — deuda de apertura por plan (sin emulador). Protege
// PROPUESTA-ETAPA-6.md §10.6: la cuota actual se deriva de `desdeCiclo`.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  cuotaAperturaEnCiclo,
  cuotasRestantesApertura,
  deudaRestanteApertura,
  aPagarAperturaEnCiclo,
} from "../../app/tarjetas/helpers/apertura.js";

const plan = {
  descripcion: "opencodeGo",
  moneda: "UYU",
  montoCuota: 5000,
  cuotasTotal: 12,
  desdeCiclo: "2026-10",
};

test("cuotaAperturaEnCiclo: derivada de desdeCiclo", () => {
  assert.deepEqual(cuotaAperturaEnCiclo(plan, "2026-10"), {
    cuotaActual: 1,
    cuotasRestantes: 11,
    monto: 5000,
  });
  assert.deepEqual(cuotaAperturaEnCiclo(plan, "2027-09"), {
    cuotaActual: 12,
    cuotasRestantes: 0,
    monto: 5000,
  });
});

test("cuotaAperturaEnCiclo: fuera de la vida del plan → null", () => {
  assert.equal(cuotaAperturaEnCiclo(plan, "2027-10"), null);
  assert.equal(cuotaAperturaEnCiclo(plan, "2026-09"), null);
});

test("cuotasRestantesApertura", () => {
  assert.equal(cuotasRestantesApertura(plan, "2026-10"), 11);
  assert.equal(cuotasRestantesApertura(plan, "2027-09"), 0);
  assert.equal(cuotasRestantesApertura(plan, "2026-09"), 0);
});

test("deudaRestanteApertura", () => {
  assert.equal(deudaRestanteApertura(plan, "2026-10"), 55000);
  assert.equal(deudaRestanteApertura(plan, "2027-09"), 0);
  assert.equal(deudaRestanteApertura(plan, "2026-09"), 0);
});

test("aPagarAperturaEnCiclo: separa por moneda", () => {
  const planes = {
    penarol: {
      descripcion: "Peñarol",
      moneda: "USD",
      montoCuota: 100,
      cuotasTotal: 12,
      desdeCiclo: "2026-10",
    },
    opencodeGo: plan,
  };

  assert.deepEqual(aPagarAperturaEnCiclo(planes, "2026-10"), {
    UYU: 5000,
    USD: 100,
  });
});
