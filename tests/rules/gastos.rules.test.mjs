// tests/rules/gastos.rules.test.mjs
// 4.5-fecha — reglas de `gastos`: `fecha` opcional (tipo + rango) y
// `createdAt` inmutable.
//
// Corre contra el `firestore.rules` del repo (igual que el archivo de
// Reintegros). `npm run test:rules` usa --test-concurrency=1 para que los dos
// archivos no se pisen el emulador (clearFirestore / ruleset).

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
const GRUPO = 'grupo_1';

let testEnv;

function dbAs(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

// Payload realista de gasto diario (el esquema no se valida en reglas, pero
// mantiene el test cerca del documento real).
function baseGasto(over = {}) {
  return {
    monto: 1000,
    producto: 'Fideos',
    productoId: 'fideos',
    esOtros: false,
    cantidad: null,
    unidad: 'u',
    detalle: null,
    categoria: 'almacen',
    subcategoria: null,
    contexto: null,
    tipo: 'personal',
    usuario: A,
    usuarioNombre: 'Alice',
    groupId: null,
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
    setDoc(doc(dbAs(A), 'gastos', 'g_fecha_oct'), baseGasto())
  );
});

test('create sin fecha → allow (compatibilidad con clientes viejos)', async () => {
  const gasto = baseGasto();
  delete gasto.fecha;

  await assertSucceeds(
    setDoc(doc(dbAs(A), 'gastos', 'g_sin_fecha'), gasto)
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
      doc(dbAs(A), 'gastos', 'g_hoy'),
      baseGasto({ fecha: Timestamp.fromDate(medianoche) })
    )
  );
});

test('create con fecha string → deny', async () => {
  await assertFails(
    setDoc(
      doc(dbAs(A), 'gastos', 'g_fecha_str'),
      baseGasto({ fecha: '2026-10-05' })
    )
  );
});

test('create con fecha anterior a 2020 → deny', async () => {
  await assertFails(
    setDoc(
      doc(dbAs(A), 'gastos', 'g_fecha_vieja'),
      baseGasto({ fecha: Timestamp.fromDate(new Date(2019, 0, 1)) })
    )
  );
});

test('create con fecha > request.time + 1 día → deny', async () => {
  const futuro = Timestamp.fromMillis(
    Date.now() + 3 * 24 * 60 * 60 * 1000
  );

  await assertFails(
    setDoc(
      doc(dbAs(A), 'gastos', 'g_fecha_futura'),
      baseGasto({ fecha: futuro })
    )
  );
});

test('create con createdAt explícito (≠ request.time) → deny', async () => {
  await assertFails(
    setDoc(
      doc(dbAs(A), 'gastos', 'g_created_viejo'),
      baseGasto({ createdAt: Timestamp.fromDate(new Date(2026, 0, 1)) })
    )
  );
});

test('create de otro usuario → deny', async () => {
  await assertFails(
    setDoc(
      doc(dbAs(A), 'gastos', 'g_ajeno'),
      baseGasto({ usuario: B })
    )
  );
});

test('create compartido con grupo del que soy miembro → allow', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'groups', GRUPO), {
      members: [A, B],
    });
  });

  await assertSucceeds(
    setDoc(
      doc(dbAs(A), 'gastos', 'g_compartido'),
      baseGasto({ tipo: 'compartido', groupId: GRUPO })
    )
  );
});

// ─── UPDATE ────────────────────────────────────────────────────────────────

test('update propio: cambia fecha, createdAt intacto → allow', async () => {
  await assertSucceeds(
    setDoc(doc(dbAs(A), 'gastos', 'g_edit'), baseGasto())
  );

  await assertSucceeds(
    updateDoc(doc(dbAs(A), 'gastos', 'g_edit'), {
      fecha: Timestamp.fromDate(new Date(2026, 8, 10)), // septiembre
      monto: 1500,
    })
  );
});

test('update que mueve createdAt → deny', async () => {
  await assertFails(
    updateDoc(doc(dbAs(A), 'gastos', 'g_edit'), {
      createdAt: Timestamp.fromDate(new Date(2025, 0, 1)),
    })
  );
});

test('update con fecha inválida → deny', async () => {
  await assertFails(
    updateDoc(doc(dbAs(A), 'gastos', 'g_edit'), {
      fecha: '2026-09-10',
    })
  );
});

test('update de un gasto ajeno → deny', async () => {
  await assertSucceeds(
    setDoc(doc(dbAs(A), 'gastos', 'g_ajeno_edit'), baseGasto())
  );

  await assertFails(
    updateDoc(doc(dbAs(B), 'gastos', 'g_ajeno_edit'), { monto: 1 })
  );
});

// ─── DELETE (regresión: update y delete se separaron) ─────────────────────

test('delete propio sigue permitido → allow', async () => {
  await assertSucceeds(
    setDoc(doc(dbAs(A), 'gastos', 'g_delete'), baseGasto())
  );

  await assertSucceeds(deleteDoc(doc(dbAs(A), 'gastos', 'g_delete')));
});
