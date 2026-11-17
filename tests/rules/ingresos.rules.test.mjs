// tests/rules/ingresos.rules.test.mjs
// 4.5-fecha — reglas de `ingresos`: `fecha` opcional (tipo + rango) y
// `createdAt` inmutable. Mismo patrón que gastos.rules.test.mjs.
//
// `npm run test:rules` usa --test-concurrency=1 para que los archivos de
// reglas no se pisen el emulador (clearFirestore / ruleset).

import { test, before, after } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rulesSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'firestore.rules'),
  'utf8'
);

const A = 'uid_alice';
const B = 'uid_bob';

let testEnv;

function dbAs(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

function baseIngreso(over = {}) {
  return {
    tipo: 'sueldo',
    subtipo: null,
    detalle: 'Sueldo octubre',
    monto: 1000,
    usuario: A,
    usuarioNombre: 'Alice',
    fecha: Timestamp.fromDate(new Date(2026, 9, 5)), // octubre 2026
    createdAt: serverTimestamp(),
    ...over,
  };
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-finanzas',
    firestore: { rules: rulesSrc },
  });
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv.cleanup();
});

// ─── CREATE ────────────────────────────────────────────────────────────────

test('create con fecha de un mes anterior → allow', async () => {
  await assertSucceeds(
    setDoc(doc(dbAs(A), 'ingresos', 'i_fecha_oct'), baseIngreso())
  );
});

test('create sin fecha → allow (compatibilidad con clientes viejos)', async () => {
  const ingreso = baseIngreso();
  delete ingreso.fecha;

  await assertSucceeds(
    setDoc(doc(dbAs(A), 'ingresos', 'i_sin_fecha'), ingreso)
  );
});

test('create con fecha de hoy (medianoche local) → allow', async () => {
  const ahora = new Date();
  const medianoche = new Date(
    ahora.getFullYear(),
    ahora.getMonth(),
    ahora.getDate()
  );

  await assertSucceeds(
    setDoc(
      doc(dbAs(A), 'ingresos', 'i_hoy'),
      baseIngreso({ fecha: Timestamp.fromDate(medianoche) })
    )
  );
});

test('create con fecha string → deny', async () => {
  await assertFails(
    setDoc(
      doc(dbAs(A), 'ingresos', 'i_fecha_str'),
      baseIngreso({ fecha: '2026-10-05' })
    )
  );
});

test('create con fecha anterior a 2020 → deny', async () => {
  await assertFails(
    setDoc(
      doc(dbAs(A), 'ingresos', 'i_fecha_vieja'),
      baseIngreso({ fecha: Timestamp.fromDate(new Date(2019, 0, 1)) })
    )
  );
});

test('create con fecha > request.time + 1 día → deny', async () => {
  const futuro = Timestamp.fromMillis(
    Date.now() + 3 * 24 * 60 * 60 * 1000
  );

  await assertFails(
    setDoc(
      doc(dbAs(A), 'ingresos', 'i_fecha_futura'),
      baseIngreso({ fecha: futuro })
    )
  );
});

test('create con createdAt explícito (≠ request.time) → deny', async () => {
  await assertFails(
    setDoc(
      doc(dbAs(A), 'ingresos', 'i_created_viejo'),
      baseIngreso({ createdAt: Timestamp.fromDate(new Date(2026, 0, 1)) })
    )
  );
});

test('create de otro usuario → deny', async () => {
  await assertFails(
    setDoc(
      doc(dbAs(A), 'ingresos', 'i_ajeno'),
      baseIngreso({ usuario: B })
    )
  );
});

// ─── UPDATE ────────────────────────────────────────────────────────────────

test('update propio: cambia fecha, createdAt intacto → allow', async () => {
  await assertSucceeds(
    setDoc(doc(dbAs(A), 'ingresos', 'i_edit'), baseIngreso())
  );

  await assertSucceeds(
    updateDoc(doc(dbAs(A), 'ingresos', 'i_edit'), {
      fecha: Timestamp.fromDate(new Date(2026, 8, 10)), // septiembre
      monto: 1500,
    })
  );
});

test('update que mueve createdAt → deny', async () => {
  await assertFails(
    updateDoc(doc(dbAs(A), 'ingresos', 'i_edit'), {
      createdAt: Timestamp.fromDate(new Date(2025, 0, 1)),
    })
  );
});

test('update con fecha inválida → deny', async () => {
  await assertFails(
    updateDoc(doc(dbAs(A), 'ingresos', 'i_edit'), {
      fecha: '2026-09-10',
    })
  );
});

test('update de un ingreso ajeno → deny', async () => {
  await assertSucceeds(
    setDoc(doc(dbAs(A), 'ingresos', 'i_ajeno_edit'), baseIngreso())
  );

  await assertFails(
    updateDoc(doc(dbAs(B), 'ingresos', 'i_ajeno_edit'), { monto: 1 })
  );
});

// ─── DELETE (regresión: update y delete se separaron) ─────────────────────

test('delete propio sigue permitido → allow', async () => {
  await assertSucceeds(
    setDoc(doc(dbAs(A), 'ingresos', 'i_delete'), baseIngreso())
  );

  await assertSucceeds(deleteDoc(doc(dbAs(A), 'ingresos', 'i_delete')));
});

// ─── 5.0 — moneda (Sueldo multimoneda) ────────────────────────────────────
// `moneda` opcional ('UYU' | 'USD') en create y update. La coherencia
// subtipo↔moneda NO se valida acá: el único guard es el helper del cliente
// (PROPUESTA-ETAPA-5 §5.0.3, P-1).

test('create con moneda UYU y USD → allow', async () => {
  await assertSucceeds(
    setDoc(
      doc(dbAs(A), 'ingresos', 'i_mon_uyu'),
      baseIngreso({ moneda: 'UYU' })
    )
  );

  await assertSucceeds(
    setDoc(
      doc(dbAs(A), 'ingresos', 'i_mon_usd'),
      baseIngreso({ moneda: 'USD', subtipo: 'sueldo_dolares' })
    )
  );
});

test('create sin moneda → allow (compatibilidad con clientes viejos)', async () => {
  await assertSucceeds(
    setDoc(doc(dbAs(A), 'ingresos', 'i_mon_none'), baseIngreso())
  );
});

test('create con moneda inválida → deny', async () => {
  for (const [i, moneda] of ['ARS', 'usd', 1].entries()) {
    await assertFails(
      setDoc(
        doc(dbAs(A), 'ingresos', `i_mon_bad_${i}`),
        baseIngreso({ moneda })
      )
    );
  }
});

test('update con moneda válida → allow; con moneda inválida → deny (createdAt intacto)', async () => {
  await assertSucceeds(
    setDoc(doc(dbAs(A), 'ingresos', 'i_mon_edit'), baseIngreso())
  );

  await assertSucceeds(
    updateDoc(doc(dbAs(A), 'ingresos', 'i_mon_edit'), { moneda: 'USD' })
  );

  await assertFails(
    updateDoc(doc(dbAs(A), 'ingresos', 'i_mon_edit'), { moneda: 'ARS' })
  );
});
