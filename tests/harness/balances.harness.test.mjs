// tests/harness/balances.harness.test.mjs
// 5.2 — persistencia de los datos manuales de /balances en users/{uid},
// contra el emulador demo-finanzas y las reglas reales.
//
// Verifica el merge profundo (inversiones/cierre del mismo mes), deleteField,
// la preservación del resto del doc y que nadie escriba el doc de otro.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import {
  deleteField,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

import {
  guardarMes,
  leerPreferencias,
} from "../../app/balances/services/preferencias.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rulesSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "firestore.rules"),
  "utf8",
);

const A = "uid_bal2_a";
const B = "uid_bal2_b";
const MISSING = "uid_bal2_missing";

let testEnv = null;

function dbAs(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

async function leerDoc() {
  const snap = await getDoc(doc(dbAs(A), "users", A));

  return snap.exists() ? snap.data() : null;
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-finanzas",
    firestore: { rules: rulesSrc },
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users", A), {
      uid: A,
      displayName: "Alice",
      email: "alice@example.com",
      balances: {
        meses: {
          "2026-10": { cajaRealAlCierre: 12000 },
        },
      },
    });
  });
});

after(async () => {
  await testEnv.cleanup();
});

test("HB12-1 — merge agrega balances sin tocar el resto del doc", async () => {
  await guardarMes({
    db: dbAs(A),
    uid: A,
    mes: "2026-10",
    cambios: { inversiones: { aportes: 1000, rescates: 0 } },
    existe: true,
  });

  const data = await leerDoc();

  assert.equal(data.uid, A);
  assert.equal(data.displayName, "Alice");
  assert.equal(data.email, "alice@example.com");
  assert.deepEqual(data.balances.meses["2026-10"].inversiones, {
    aportes: 1000,
    rescates: 0,
  });
  assert.equal(data.balances.meses["2026-10"].cajaRealAlCierre, 12000);
});

test("HB12-2 — merge parcial del mismo mes conserva los otros campos", async () => {
  await guardarMes({
    db: dbAs(A),
    uid: A,
    mes: "2026-10",
    cambios: { cajaAlInicio: 9000 },
    existe: true,
  });

  const data = await leerDoc();

  assert.equal(data.balances.meses["2026-10"].cajaAlInicio, 9000);
  assert.deepEqual(data.balances.meses["2026-10"].inversiones, {
    aportes: 1000,
    rescates: 0,
  });
  assert.equal(data.balances.meses["2026-10"].cajaRealAlCierre, 12000);
});

test("HB12-3 — deleteField borra solo el dato indicado", async () => {
  await guardarMes({
    db: dbAs(A),
    uid: A,
    mes: "2026-10",
    cambios: { inversiones: deleteField() },
    existe: true,
  });

  const data = await leerDoc();

  assert.equal("inversiones" in data.balances.meses["2026-10"], false);
  assert.equal(data.balances.meses["2026-10"].cajaAlInicio, 9000);
  assert.equal(data.balances.meses["2026-10"].cajaRealAlCierre, 12000);
});

test("HB12-4 — escribir el doc de otro usuario es denegado por reglas", async () => {
  await assert.rejects(
    guardarMes({
      db: dbAs(B),
      uid: A,
      mes: "2026-10",
      cambios: { cajaAlInicio: 1 },
      existe: true,
    }),
    (error) => {
      assert.equal(error.codigo, "ESCRITURA_PREFERENCIAS");

      return true;
    },
  );
});

test("HB12-5 — leerPreferencias normaliza el doc (y el doc ausente)", async () => {
  const prefs = await leerPreferencias({ db: dbAs(A), uid: A });

  assert.equal(prefs.existe, true);
  assert.equal(prefs.meses["2026-10"].cajaRealAlCierre, 12000);
  assert.equal(prefs.meses["2026-10"].cajaAlInicio, 9000);

  const ausente = await leerPreferencias({
    db: dbAs(A),
    uid: MISSING,
  });

  assert.equal(ausente.existe, false);
  assert.deepEqual(ausente.meses, {});
});
