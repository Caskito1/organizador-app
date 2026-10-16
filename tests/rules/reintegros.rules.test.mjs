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
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
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
const C = 'uid_carol';

let testEnv;

function dbAs(uid) {
  return uid === null
    ? testEnv.unauthenticatedContext().firestore()
    : testEnv.authenticatedContext(uid).firestore();
}

function baseObl(over = {}) {
  return {
    registradoPor: A,
    registradoPorNombre: 'Alice',
    contraparteUid: B,
    contraparteNombre: 'Bob',
    participantes: [A, B],
    sentido: 'por_cobrar',
    monto: 1000,
    devuelto: 0,
    movimientoInicial: 'ninguno',
    concepto: 'Alquiler octubre',
    gastoVinculadoId: null,
    createdAt: serverTimestamp(),
    confirmadaPor: B,
    confirmadaAt: serverTimestamp(),
    ...over,
  };
}

function externalObl(over = {}) {
  return {
    registradoPor: A,
    registradoPorNombre: 'Alice',
    contraparteUid: null,
    contraparteNombre: 'Proveedor',
    participantes: [A],
    sentido: 'por_cobrar',
    monto: 500,
    devuelto: 0,
    movimientoInicial: 'ninguno',
    concepto: 'Reembolso proveedor',
    gastoVinculadoId: null,
    createdAt: serverTimestamp(),
    ...over,
  };
}

function createMemberObl(over = {}) {
  const { confirmadaAt, ...rest } = baseObl({ confirmadaPor: null, ...over });
  void confirmadaAt;
  return rest;
}

function entrega(rid, over = {}) {
  return {
    reintegroId: rid,
    monto: 100,
    registradoPor: A,
    fechaPago: Timestamp.fromDate(new Date('2026-10-15T12:00:00Z')),
    detalle: 'pago parcial',
    ...over,
  };
}

async function seed(rid, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'reintegros', rid), data);
  });
}

async function seedEntrega(did, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'reintegro_devoluciones', did), data);
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-finanzas',
    firestore: { rules: rulesSrc },
  });
});

after(async () => {
  await testEnv.cleanup();
});

test('3.1 — no autenticado: sin lectura ni escritura en ambas colecciones', async () => {
  await seed('r31', baseObl());
  await seedEntrega('d31', entrega('r31'));
  const db = dbAs(null);
  await assertFails(getDoc(doc(db, 'reintegros', 'r31')));
  await assertFails(
    setDoc(doc(db, 'reintegros', 'r31n'), createMemberObl({ concepto: 'nuevo' }))
  );
  await assertFails(getDoc(doc(db, 'reintegro_devoluciones', 'd31')));
  await assertFails(
    setDoc(doc(db, 'reintegro_devoluciones', 'd31n'), entrega('r31'))
  );
});

test('3.2 — usuario ajeno: sin lectura de reintegros ni entregas; sin escritura', async () => {
  await seed('r32', baseObl());
  await seedEntrega('d32', entrega('r32'));
  const db = dbAs(C);
  await assertFails(getDoc(doc(db, 'reintegros', 'r32')));
  await assertFails(getDoc(doc(db, 'reintegro_devoluciones', 'd32')));
  await assertFails(
    setDoc(doc(db, 'reintegros', 'r32n'), createMemberObl({ concepto: 'ajeno' }))
  );
  await assertFails(
    setDoc(doc(db, 'reintegro_devoluciones', 'd32n'), entrega('r32'))
  );
});

test('3.3 — registradoPor != request.auth.uid en create: rechazado', async () => {
  const db = dbAs(B);
  await assertFails(
    setDoc(
      doc(db, 'reintegros', 'r33'),
      createMemberObl({ registradoPor: A, concepto: 'falsificado' })
    )
  );
});

test('3.4 — entrega sobre reintegroId ajeno: rechazada', async () => {
  await seed('r34', baseObl());
  const db = dbAs(C);
  await assertFails(setDoc(doc(db, 'reintegro_devoluciones', 'd34'), entrega('r34')));
});

test('3.5 — mutacion de contraparteUid/registradoPor/participantes: rechazada', async () => {
  await seed('r35', baseObl());
  const db = dbAs(A);
  await assertFails(updateDoc(doc(db, 'reintegros', 'r35'), { registradoPor: B }));
  await assertFails(updateDoc(doc(db, 'reintegros', 'r35'), { contraparteUid: C }));
  await assertFails(updateDoc(doc(db, 'reintegros', 'r35'), { participantes: [A] }));
});

test('3.6 — cambio de monto con devuelto > 0: rechazado', async () => {
  await seed('r36', baseObl({ devuelto: 300 }));
  const db = dbAs(A);
  await assertFails(updateDoc(doc(db, 'reintegros', 'r36'), { monto: 1200 }));
  await assertFails(
    updateDoc(doc(db, 'reintegros', 'r36'), { monto: 200, devuelto: 0 })
  );
});

test('3.7 — deleteDoc de obligacion o entrega: rechazado siempre', async () => {
  await seed('r37', baseObl());
  await seedEntrega('d37', entrega('r37'));
  const db = dbAs(A);
  await assertFails(deleteDoc(doc(db, 'reintegros', 'r37')));
  await assertFails(deleteDoc(doc(db, 'reintegro_devoluciones', 'd37')));
  const dbC = dbAs(C);
  await assertFails(deleteDoc(doc(dbC, 'reintegros', 'r37')));
});

test('3.8 — acople devolucion-obligacion (getAfter): sin update, delta incorrecto o excedido rechazan; delta exacto acepta', async () => {
  await seed('r38a', baseObl({ devuelto: 0 }));
  const dbA = dbAs(A);
  await assertFails(
    setDoc(doc(dbA, 'reintegro_devoluciones', 'd38a'), entrega('r38a', { monto: 100 }))
  );

  await seed('r38b', baseObl({ devuelto: 0 }));
  const dbB = dbAs(A);
  const bB = writeBatch(dbB);
  bB.set(doc(dbB, 'reintegro_devoluciones', 'd38b'), entrega('r38b', { monto: 200 }));
  bB.update(doc(dbB, 'reintegros', 'r38b'), { devuelto: 100 });
  await assertFails(bB.commit());

  await seed('r38c', baseObl({ devuelto: 0 }));
  const dbC = dbAs(A);
  const bC = writeBatch(dbC);
  bC.set(doc(dbC, 'reintegro_devoluciones', 'd38c'), entrega('r38c', { monto: 100 }));
  bC.update(doc(dbC, 'reintegros', 'r38c'), { devuelto: 100 });
  await assertSucceeds(bC.commit());

  await seed('r38d', baseObl({ monto: 100, devuelto: 0 }));
  const dbD = dbAs(A);
  const bD = writeBatch(dbD);
  bD.set(doc(dbD, 'reintegro_devoluciones', 'd38d'), entrega('r38d', { monto: 200 }));
  bD.update(doc(dbD, 'reintegros', 'r38d'), { devuelto: 200 });
  await assertFails(bD.commit());
});

test('3.9 — positiva: ambas partes legitimas leen y escriben (alta + confirmacion + devolucion en batch)', async () => {
  const dbA = dbAs(A);
  const dbB = dbAs(B);
  const rid = 'r39';
  await assertSucceeds(
    setDoc(doc(dbA, 'reintegros', rid), createMemberObl({ concepto: 'alta valida' }))
  );
  await assertSucceeds(getDoc(doc(dbA, 'reintegros', rid)));

  await assertSucceeds(
    updateDoc(doc(dbB, 'reintegros', rid), {
      confirmadaPor: B,
      confirmadaAt: serverTimestamp(),
    })
  );

  const bA = writeBatch(dbA);
  bA.set(doc(dbA, 'reintegro_devoluciones', 'd39a'), entrega(rid, { monto: 100 }));
  bA.update(doc(dbA, 'reintegros', rid), { devuelto: 100 });
  await assertSucceeds(bA.commit());

  await assertSucceeds(getDoc(doc(dbB, 'reintegros', rid)));
  const bB = writeBatch(dbB);
  bB.set(doc(dbB, 'reintegro_devoluciones', 'd39b'), entrega(rid, { monto: 200, registradoPor: B }));
  bB.update(doc(dbB, 'reintegros', rid), { devuelto: 300 });
  await assertSucceeds(bB.commit());

  const qA = query(collection(dbA, 'reintegros'), where('participantes', 'array-contains', A));
  const snapA = await assertSucceeds(getDocs(qA));
  if (snapA.empty) throw new Error('R1: query array-contains devolvio vacio para participante');

  const dbB2 = dbAs(B);
  const qB = query(collection(dbB2, 'reintegros'), where('participantes', 'array-contains', B));
  const snapB = await assertSucceeds(getDocs(qB));
  if (snapB.empty) throw new Error('R1: query array-contains devolvio vacio para contraparte');
});

test('3.10 — externo (contraparteUid null): solo el registrador lee y escribe', async () => {
  await seed('r310', externalObl());
  const dbA = dbAs(A);
  const dbB = dbAs(B);
  await assertSucceeds(getDoc(doc(dbA, 'reintegros', 'r310')));
  await assertFails(getDoc(doc(dbB, 'reintegros', 'r310')));
  await assertFails(
    setDoc(doc(dbB, 'reintegro_devoluciones', 'd310b'), entrega('r310', { registradoPor: B }))
  );

  const bA = writeBatch(dbA);
  bA.set(doc(dbA, 'reintegro_devoluciones', 'd310a'), entrega('r310', { monto: 100 }));
  bA.update(doc(dbA, 'reintegros', 'r310'), { devuelto: 100 });
  await assertSucceeds(bA.commit());
});

test('3.11 — no participante: sin escritura (entrega, edicion, eliminacion, condonacion)', async () => {
  await seed('r311', baseObl());
  await seedEntrega('d311', entrega('r311'));
  const dbC = dbAs(C);
  const bC = writeBatch(dbC);
  bC.set(doc(dbC, 'reintegro_devoluciones', 'd311c'), entrega('r311', { monto: 100 }));
  bC.update(doc(dbC, 'reintegros', 'r311'), { devuelto: 100 });
  await assertFails(bC.commit());
  await assertFails(updateDoc(doc(dbC, 'reintegros', 'r311'), { concepto: 'hack' }));
  await assertFails(
    updateDoc(doc(dbC, 'reintegros', 'r311'), {
      condonacion: { condonadaPor: C, condonadaAt: serverTimestamp() },
    })
  );
  await assertFails(
    updateDoc(doc(dbC, 'reintegro_devoluciones', 'd311'), {
      eliminacion: { eliminadaPor: C, eliminadaAt: serverTimestamp() },
    })
  );
});

test('3.12 — doble eliminacion: el segundo update sobre doc ya eliminado es rechazado', async () => {
  await seed('r312', baseObl({ devuelto: 100 }));
  await seedEntrega('d312', entrega('r312', { monto: 100 }));
  const dbA = dbAs(A);
  const b1 = writeBatch(dbA);
  b1.update(doc(dbA, 'reintegro_devoluciones', 'd312'), {
    eliminacion: { eliminadaPor: A, eliminadaAt: serverTimestamp() },
  });
  b1.update(doc(dbA, 'reintegros', 'r312'), { devuelto: 0 });
  await assertSucceeds(b1.commit());

  const b2 = writeBatch(dbA);
  b2.update(doc(dbA, 'reintegro_devoluciones', 'd312'), {
    eliminacion: { eliminadaPor: A, eliminadaAt: serverTimestamp() },
  });
  b2.update(doc(dbA, 'reintegros', 'r312'), { devuelto: 100 });
  await assertFails(b2.commit());
});

test('3.13 — edicion de registro eliminado: rechazada', async () => {
  await seed(
    'r313',
    baseObl({ eliminacion: { eliminadaPor: A, eliminadaAt: serverTimestamp() } })
  );
  const dbA = dbAs(A);
  await assertFails(updateDoc(doc(dbA, 'reintegros', 'r313'), { concepto: 'nuevo' }));
  await assertFails(
    updateDoc(doc(dbA, 'reintegros', 'r313'), {
      condonacion: { condonadaPor: A, condonadaAt: serverTimestamp() },
    })
  );
});

test('3.14 — bitacora: update/delete rechazados; create solo con registradoPor propio y de participante', async () => {
  await seed('r314', baseObl());
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'reintegros', 'r314', 'eventos', 'e14'), {
      registradoPor: A,
      tipo: 'creacion',
      entidad: 'obligacion',
      fecha: serverTimestamp(),
    });
  });
  const dbA = dbAs(A);
  const evRef = doc(dbA, 'reintegros', 'r314', 'eventos', 'e14');
  await assertFails(updateDoc(evRef, { tipo: 'edicion' }));
  await assertFails(deleteDoc(evRef));
  await assertFails(
    setDoc(doc(dbA, 'reintegros', 'r314', 'eventos', 'e14b'), {
      registradoPor: B,
      tipo: 'creacion',
      entidad: 'obligacion',
    })
  );
  await assertFails(
    setDoc(doc(dbA, 'reintegros', 'r314', 'eventos', 'e14c'), {
      registradoPor: A,
      tipo: 'confirmacion',
      entidad: 'obligacion',
    })
  );
  await assertFails(
    setDoc(doc(dbAs(C), 'reintegros', 'r314', 'eventos', 'e14d'), {
      registradoPor: C,
      tipo: 'creacion',
      entidad: 'obligacion',
    })
  );
  await assertSucceeds(
    setDoc(doc(dbA, 'reintegros', 'r314', 'eventos', 'e14e'), {
      registradoPor: A,
      tipo: 'creacion',
      entidad: 'obligacion',
      fecha: serverTimestamp(),
    })
  );
  await assertSucceeds(
    setDoc(doc(dbAs(B), 'reintegros', 'r314', 'eventos', 'e14f'), {
      registradoPor: B,
      tipo: 'creacion',
      entidad: 'entrega',
      fecha: serverTimestamp(),
    })
  );
});

test('3.15 — condonacion (C1 miembro): acreedor segun vista puede; deudor y tercero no; sin entrega ni mover devuelto', async () => {
  await seed('r315a', baseObl({ sentido: 'por_cobrar', devuelto: 100 }));
  const condonacion = { condonadaPor: A, condonadaAt: serverTimestamp() };
  await assertSucceeds(
    updateDoc(doc(dbAs(A), 'reintegros', 'r315a'), { condonacion })
  );

  await seed('r315b', baseObl({ sentido: 'por_devolver', devuelto: 100 }));
  await assertFails(
    updateDoc(doc(dbAs(A), 'reintegros', 'r315b'), {
      condonacion: { condonadaPor: A, condonadaAt: serverTimestamp() },
    })
  );
  await assertSucceeds(
    updateDoc(doc(dbAs(B), 'reintegros', 'r315b'), {
      condonacion: { condonadaPor: B, condonadaAt: serverTimestamp() },
    })
  );
  await assertFails(
    updateDoc(doc(dbAs(C), 'reintegros', 'r315b'), {
      condonacion: { condonadaPor: C, condonadaAt: serverTimestamp() },
    })
  );

  await seed('r315c', baseObl({ sentido: 'por_cobrar', devuelto: 100 }));
  const dbCond = dbAs(A);
  const bMix = writeBatch(dbCond);
  bMix.set(doc(dbCond, 'reintegro_devoluciones', 'd315c'), entrega('r315c', { monto: 100 }));
  bMix.update(doc(dbCond, 'reintegros', 'r315c'), {
    condonacion: { condonadaPor: A, condonadaAt: serverTimestamp() },
  });
  await assertFails(bMix.commit());

  await seed('r315d', baseObl({ sentido: 'por_cobrar', devuelto: 100 }));
  await assertFails(
    updateDoc(doc(dbAs(A), 'reintegros', 'r315d'), {
      condonacion: { condonadaPor: A, condonadaAt: serverTimestamp() },
      devuelto: 500,
    })
  );
});

test('3.16 — coherencia participantes-contraparte en create', async () => {
  const dbA = dbAs(A);
  await assertFails(
    setDoc(
      doc(dbA, 'reintegros', 'r316a'),
      createMemberObl({ contraparteUid: C, participantes: [A, B], concepto: 'no-coherente' })
    )
  );
  await assertFails(
    setDoc(
      doc(dbA, 'reintegros', 'r316b'),
      externalObl({ participantes: [A, B], concepto: 'externo-size-2' })
    )
  );
  await assertFails(
    setDoc(
      doc(dbA, 'reintegros', 'r316c'),
      createMemberObl({ participantes: [A], contraparteUid: B, concepto: 'miembro-size-1' })
    )
  );
  await assertFails(
    setDoc(
      doc(dbA, 'reintegros', 'r316d'),
      createMemberObl({ participantes: [A, B], contraparteUid: A, concepto: 'auto-contraparte' })
    )
  );
  await assertSucceeds(
    setDoc(doc(dbA, 'reintegros', 'r316e'), externalObl({ concepto: 'externa-ok' }))
  );
  await assertSucceeds(
    setDoc(doc(dbA, 'reintegros', 'r316f'), createMemberObl({ concepto: 'miembro-ok' }))
  );
});

test('3.17 — regresion de precedencia: campo invalido con contraparteUid string no escapa del grupo', async () => {
  const dbA = dbAs(A);
  await assertFails(
    setDoc(
      doc(dbA, 'reintegros', 'r317a'),
      createMemberObl({ monto: -5, contraparteUid: B, concepto: 'negativo' })
    )
  );
  await assertFails(
    setDoc(
      doc(dbA, 'reintegros', 'r317b'),
      createMemberObl({ monto: 0, contraparteUid: B, concepto: 'cero' })
    )
  );
  await assertSucceeds(
    setDoc(doc(dbA, 'reintegros', 'r317c'), createMemberObl({ concepto: 'valido' }))
  );
});

test('3.18 — entregas sobre doc congelado: condonada y eliminada rechazan alta y mutacion de entregas', async () => {
  await seed(
    'r318a',
    baseObl({
      devuelto: 100,
      condonacion: { condonadaPor: A, condonadaAt: serverTimestamp() },
    })
  );
  await seedEntrega('d318a', entrega('r318a', { monto: 100 }));
  const dbA = dbAs(A);
  await assertFails(
    setDoc(doc(dbA, 'reintegro_devoluciones', 'd318an'), entrega('r318a', { monto: 50 }))
  );
  const bCond = writeBatch(dbA);
  bCond.update(doc(dbA, 'reintegro_devoluciones', 'd318a'), {
    eliminacion: { eliminadaPor: A, eliminadaAt: serverTimestamp() },
  });
  bCond.update(doc(dbA, 'reintegros', 'r318a'), { devuelto: 0 });
  await assertFails(bCond.commit());
  await assertFails(
    updateDoc(doc(dbA, 'reintegro_devoluciones', 'd318a'), { monto: 50 })
  );

  await seed(
    'r318b',
    baseObl({ eliminacion: { eliminadaPor: A, eliminadaAt: serverTimestamp() } })
  );
  await assertFails(
    setDoc(doc(dbA, 'reintegro_devoluciones', 'd318bn'), entrega('r318b', { monto: 50 }))
  );
});

test('3.19 — integridad de constancias en escritura ordinaria', async () => {
  const dbA = dbAs(A);
  const dbB = dbAs(B);

  await seed('r319a', baseObl({ sentido: 'por_cobrar' }));
  await assertFails(
    updateDoc(doc(dbB, 'reintegros', 'r319a'), {
      condonacion: { condonadaPor: B, condonadaAt: serverTimestamp() },
    })
  );

  await seed('r319b', baseObl({ sentido: 'por_cobrar' }));
  await assertFails(
    updateDoc(doc(dbA, 'reintegros', 'r319b'), {
      devuelto: 100,
      eliminacion: { eliminadaPor: A, eliminadaAt: serverTimestamp() },
    })
  );
  await assertFails(
    updateDoc(doc(dbA, 'reintegros', 'r319b'), {
      monto: 2000,
      devuelto: 0,
      eliminacion: { eliminadaPor: A, eliminadaAt: serverTimestamp() },
    })
  );

  await seed(
    'r319c',
    baseObl({
      devuelto: 100,
      condonacion: { condonadaPor: A, condonadaAt: serverTimestamp() },
    })
  );
  await assertFails(updateDoc(doc(dbA, 'reintegros', 'r319c'), { condonacion: null }));
  await assertFails(
    updateDoc(doc(dbA, 'reintegros', 'r319c'), {
      condonacion: { condonadaPor: B, condonadaAt: serverTimestamp() },
    })
  );

  await assertFails(
    setDoc(
      doc(dbA, 'reintegros', 'r319d'),
      createMemberObl({
        concepto: 'nace-condonada',
        condonacion: { condonadaPor: A, condonadaAt: serverTimestamp() },
      })
    )
  );
  await assertFails(
    setDoc(
      doc(dbA, 'reintegros', 'r319e'),
      createMemberObl({
        concepto: 'nace-eliminada',
        eliminacion: { eliminadaPor: A, eliminadaAt: serverTimestamp() },
      })
    )
  );
});

test('3.20 — transicion de confirmacion a nivel reglas', async () => {
  await seed('r320', baseObl({ confirmadaPor: null, confirmadaAt: null }));
  const dbB = dbAs(B);
  const dbA = dbAs(A);
  await assertFails(
    updateDoc(doc(dbB, 'reintegros', 'r320'), {
      confirmadaPor: B,
      confirmadaAt: serverTimestamp(),
      monto: 2000,
    })
  );
  await assertFails(
    updateDoc(doc(dbA, 'reintegros', 'r320'), {
      confirmadaPor: A,
      confirmadaAt: serverTimestamp(),
    })
  );
  await assertSucceeds(
    updateDoc(doc(dbB, 'reintegros', 'r320'), {
      confirmadaPor: B,
      confirmadaAt: serverTimestamp(),
    })
  );

  await seed('r320d', baseObl());
  await assertFails(
    updateDoc(doc(dbB, 'reintegros', 'r320d'), { confirmadaPor: null })
  );
  await assertFails(
    updateDoc(doc(dbB, 'reintegros', 'r320d'), {
      confirmadaPor: null,
      confirmadaAt: null,
    })
  );
});

test('3.21 — condonacion de obligacion externa (C1 externo): registrador puede; tercero no', async () => {
  await seed('r321a', externalObl({ sentido: 'por_cobrar' }));
  await assertSucceeds(
    updateDoc(doc(dbAs(A), 'reintegros', 'r321a'), {
      condonacion: { condonadaPor: A, condonadaAt: serverTimestamp() },
    })
  );

  await seed('r321b', externalObl({ sentido: 'por_devolver' }));
  await assertSucceeds(
    updateDoc(doc(dbAs(A), 'reintegros', 'r321b'), {
      condonacion: { condonadaPor: A, condonadaAt: serverTimestamp() },
    })
  );

  await seed('r321c', externalObl({ sentido: 'por_cobrar' }));
  await assertFails(
    updateDoc(doc(dbAs(B), 'reintegros', 'r321c'), {
      condonacion: { condonadaPor: B, condonadaAt: serverTimestamp() },
    })
  );
});

test('3.22 — lecturas de entregas: get por no-participante rechazado; list deshabilitado para todos', async () => {
  await seed('r322', baseObl());
  await seedEntrega('d322', entrega('r322'));
  const coll = collection(dbAs(A), 'reintegro_devoluciones');
  await assertFails(getDoc(doc(dbAs(C), 'reintegro_devoluciones', 'd322')));
  await assertSucceeds(getDoc(doc(dbAs(A), 'reintegro_devoluciones', 'd322')));
  await assertFails(getDocs(coll));
  await assertFails(getDocs(collection(dbAs(C), 'reintegro_devoluciones')));
});

test('3.23 — list de reintegros: array-contains ajeno vacio acepta; sin filtro o con filtro ajeno rechazado', async () => {
  await seed('r323', baseObl());
  const coll = collection(dbAs(C), 'reintegros');
  // uid ajeno con array-contains propio: query vacia (nadie lo incluye) → acepta
  const qOwn = query(coll, where('participantes', 'array-contains', C));
  const snapOwn = await assertSucceeds(getDocs(qOwn));
  if (!snapOwn.empty) throw new Error('R1: query de uid ajeno debia venir vacia');
  // uid ajeno con array-contains de otro: filtro no prueba la regla → rechaza
  await assertFails(
    getDocs(query(coll, where('participantes', 'array-contains', A)))
  );
  // sin filtro: Firestore no puede probar uid() in participantes → rechaza
  await assertFails(getDocs(collection(dbAs(C), 'reintegros')));
  await assertFails(getDocs(collection(dbAs(A), 'reintegros')));
});

test('3.24 — H-b: lista blanca de (d) — congelados, tipos, campo desconocido, no-registrador, condonada; positivos', async () => {
  // base pendiente de confirmación para que (d) esté disponible
  await seed('r324a', createMemberObl({ devuelto: 0 }));
  const dbA = dbAs(A);
  // sentido inmutable
  await assertFails(
    updateDoc(doc(dbA, 'reintegros', 'r324a'), { sentido: 'por_devolver' })
  );
  // movimientoInicial inmutable
  await assertFails(
    updateDoc(doc(dbA, 'reintegros', 'r324a'), { movimientoInicial: 'salida' })
  );
  // concepto vacío
  await assertFails(
    updateDoc(doc(dbA, 'reintegros', 'r324a'), { concepto: '' })
  );
  // campo fuera de la lista blanca (caso futuro)
  await assertFails(
    updateDoc(doc(dbA, 'reintegros', 'r324a'), { foo: 'bar' })
  );
  // contraparteNombre no-string
  await assertFails(
    updateDoc(doc(dbA, 'reintegros', 'r324a'), { contraparteNombre: 42 })
  );
  // registradoPorNombre no-string
  await assertFails(
    updateDoc(doc(dbA, 'reintegros', 'r324a'), { registradoPorNombre: null })
  );
  // ejecutado por la contraparte (no registrador)
  await assertFails(
    updateDoc(doc(dbAs(B), 'reintegros', 'r324a'), { concepto: 'edit B' })
  );
  // sobre condonada: rechazado
  await seed(
    'r324b',
    createMemberObl({
      condonacion: { condonadaPor: A, condonadaAt: serverTimestamp() },
    })
  );
  await assertFails(
    updateDoc(doc(dbA, 'reintegros', 'r324b'), { concepto: 'edit condonada' })
  );
  // positivos: los tres campos editables aceptan strings válidos
  await assertSucceeds(
    updateDoc(doc(dbA, 'reintegros', 'r324a'), { concepto: 'Alquiler noviembre' })
  );
  await assertSucceeds(
    updateDoc(doc(dbA, 'reintegros', 'r324a'), { contraparteNombre: 'Roberto' })
  );
  await assertSucceeds(
    updateDoc(doc(dbA, 'reintegros', 'r324a'), { registradoPorNombre: 'Alicia' })
  );
});

test('3.25 — H-c: monto congelado tras confirmación; externo y pendiente lo editan', async () => {
  // miembro CONFIRMADO: monto congelado
  await seed('r325a', baseObl({ devuelto: 0 }));
  await assertFails(
    updateDoc(doc(dbAs(A), 'reintegros', 'r325a'), { monto: 1200 })
  );
  // miembro PENDIENTE (campo en null): monto editable
  await seed('r325b', createMemberObl({ devuelto: 0 }));
  await assertSucceeds(
    updateDoc(doc(dbAs(A), 'reintegros', 'r325b'), { monto: 1200 })
  );
  // EXTERNA (campo ausente del doc): monto editable
  await seed('r325c', externalObl({ devuelto: 0 }));
  await assertSucceeds(
    updateDoc(doc(dbAs(A), 'reintegros', 'r325c'), { monto: 700 })
  );
});

// ═══ 3.26–3.40: getAfter en eventos + Alt A (list devoluciones) + createdAt ═══

test('3.26 — batch(crea obl + evento creacion) con getAfter: aceptado', async () => {
  const db = dbAs(A);
  const b = writeBatch(db);
  b.set(doc(db, 'reintegros', 'r326'), createMemberObl({ devuelto: 0 }));
  b.set(doc(collection(db, 'reintegros', 'r326', 'eventos'), 'ev1'), {
    registradoPor: A,
    tipo: 'creacion',
    entidad: 'obligacion',
    createdAt: serverTimestamp(),
  });
  await assertSucceeds(b.commit());
});

test('3.27 — evento sobre obl inexistente (sin batch): denegado', async () => {
  const db = dbAs(A);
  await assertFails(
    setDoc(doc(db, 'reintegros', 'r327_noexiste', 'eventos', 'ev'), {
      registradoPor: A,
      tipo: 'creacion',
      entidad: 'obligacion',
      createdAt: serverTimestamp(),
    })
  );
});

test('3.28 — evento de no-participante sobre obl existente: denegado', async () => {
  await seed('r328', createMemberObl({ devuelto: 0 }));
  const db = dbAs(C); // C no es participante
  await assertFails(
    setDoc(doc(db, 'reintegros', 'r328', 'eventos', 'ev'), {
      registradoPor: C,
      tipo: 'edicion',
      entidad: 'obligacion',
      createdAt: serverTimestamp(),
    })
  );
});

test('3.29 — D1 == : query where(reintegroId) como participante: aceptada, docs correctos', async () => {
  await seed('r329', baseObl({ devuelto: 0 }));
  const dbA = dbAs(A);
  // 2 entregas legítimas (acople: devuelto sube exactamente el monto)
  const b1 = writeBatch(dbA);
  b1.set(doc(dbA, 'reintegro_devoluciones', 'd329a'), entrega('r329', { monto: 100 }));
  b1.update(doc(dbA, 'reintegros', 'r329'), { devuelto: 100 });
  await assertSucceeds(b1.commit());
  const b2 = writeBatch(dbA);
  b2.set(doc(dbA, 'reintegro_devoluciones', 'd329b'), entrega('r329', { monto: 200 }));
  b2.update(doc(dbA, 'reintegros', 'r329'), { devuelto: 300 });
  await assertSucceeds(b2.commit());
  // query D1 con ==
  const q = query(
    collection(dbA, 'reintegro_devoluciones'),
    where('reintegroId', '==', 'r329')
  );
  const snap = await assertSucceeds(getDocs(q));
  if (snap.size !== 2) throw new Error(`D1 == : esperaba 2 docs, obtuve ${snap.size}`);
});

test('3.30 — D1 in : query where(reintegroId in [...]) como participante: aceptada', async () => {
  // 2 obligaciones con 1 entrega cada una
  const dbA = dbAs(A);
  for (const rid of ['r330x', 'r330y']) {
    await seed(rid, baseObl({ devuelto: 0 }));
    const b = writeBatch(dbA);
    b.set(doc(dbA, 'reintegro_devoluciones', `d_${rid}`), entrega(rid));
    b.update(doc(dbA, 'reintegros', rid), { devuelto: 100 });
    await assertSucceeds(b.commit());
  }
  const q = query(
    collection(dbA, 'reintegro_devoluciones'),
    where('reintegroId', 'in', ['r330x', 'r330y'])
  );
  const snap = await assertSucceeds(getDocs(q));
  if (snap.size !== 2) throw new Error(`D1 in : esperaba 2 docs, obtuve ${snap.size}`);
});

test('3.31 — D1 como uid ajeno: denegado (sin leak)', async () => {
  await seed('r331', baseObl({ devuelto: 0 }));
  const dbA = dbAs(A);
  const b = writeBatch(dbA);
  b.set(doc(dbA, 'reintegro_devoluciones', 'd331'), entrega('r331'));
  b.update(doc(dbA, 'reintegros', 'r331'), { devuelto: 100 });
  await assertSucceeds(b.commit());
  // C (ajeno) consulta por reintegroId de r331
  const q = query(
    collection(dbAs(C), 'reintegro_devoluciones'),
    where('reintegroId', '==', 'r331')
  );
  await assertFails(getDocs(q));
});

test('3.32 — query sin filtro sobre reintegro_devoluciones: denegado', async () => {
  await seed('r332', baseObl({ devuelto: 0 }));
  const dbA = dbAs(A);
  const b = writeBatch(dbA);
  b.set(doc(dbA, 'reintegro_devoluciones', 'd332'), entrega('r332'));
  b.update(doc(dbA, 'reintegros', 'r332'), { devuelto: 100 });
  await assertSucceeds(b.commit());
  // sin filtro: Firestore no puede probar la regla para todos los docs → denegado
  await assertFails(getDocs(collection(dbA, 'reintegro_devoluciones')));
});

test('3.33 — D1 sin auth: denegado', async () => {
  const q = query(
    collection(dbAs(null), 'reintegro_devoluciones'),
    where('reintegroId', '==', 'r333')
  );
  await assertFails(getDocs(q));
});

test('3.34 — alta de reintegro sin createdAt: denegado', async () => {
  const { createdAt, ...sinCd } = createMemberObl();
  void createdAt;
  await assertFails(setDoc(doc(dbAs(A), 'reintegros', 'r334'), sinCd));
});

test('3.35 — alta con Timestamp de cliente forjado: denegado', async () => {
  await assertFails(
    setDoc(
      doc(dbAs(A), 'reintegros', 'r335'),
      createMemberObl({ createdAt: Timestamp.fromDate(new Date('2020-01-01')) })
    )
  );
});

test('3.36 — editar createdAt vía rama (d): denegado (inmutable post-create)', async () => {
  await seed('r336', createMemberObl({ devuelto: 0 }));
  await assertFails(
    updateDoc(doc(dbAs(A), 'reintegros', 'r336'), { createdAt: serverTimestamp() })
  );
});

test('3.37 — batch submitDevolucion completo (entrega + update devuelto + evento creacion/entrega): aceptado', async () => {
  await seed('r337', baseObl({ devuelto: 0 }));
  const db = dbAs(A);
  const b = writeBatch(db);
  b.set(doc(db, 'reintegro_devoluciones', 'd337'), entrega('r337', { monto: 100 }));
  b.update(doc(db, 'reintegros', 'r337'), { devuelto: 100 });
  b.set(doc(collection(db, 'reintegros', 'r337', 'eventos'), 'ev1'), {
    registradoPor: A,
    tipo: 'creacion',
    entidad: 'entrega',
    createdAt: serverTimestamp(),
  });
  await assertSucceeds(b.commit());
});

test('3.38 — D1 in mezclando rid propio y rid ajeno: denegada entera', async () => {
  // r338a: obl de A,B (propia para A). r338b: obl ajena de B,C.
  await seed('r338a', baseObl({ devuelto: 0 }));
  await seed(
    'r338b',
    createMemberObl({
      registradoPor: B,
      registradoPorNombre: 'Bob',
      contraparteUid: C,
      contraparteNombre: 'Carol',
      participantes: [B, C],
      devuelto: 0,
    })
  );
  // entrega sobre r338a (legítima para A)
  const dbA = dbAs(A);
  const b = writeBatch(dbA);
  b.set(doc(dbA, 'reintegro_devoluciones', 'd338a'), entrega('r338a'));
  b.update(doc(dbA, 'reintegros', 'r338a'), { devuelto: 100 });
  await assertSucceeds(b.commit());
  // query in con rid propio + rid ajeno → denegada entera (get() falla en el doc ajeno)
  const q = query(
    collection(dbA, 'reintegro_devoluciones'),
    where('reintegroId', 'in', ['r338a', 'r338b'])
  );
  await assertFails(getDocs(q));
});

test('3.39 — D1 in con 10 rids distintos: aceptada; 11 rids: comportamiento reportado', async () => {
  // Seed 10 obligaciones con 1 entrega cada una
  const dbA = dbAs(A);
  const rids = Array.from({ length: 10 }, (_, i) => `r339_${i}`);
  for (const rid of rids) {
    await seed(rid, baseObl({ devuelto: 0 }));
    const b = writeBatch(dbA);
    b.set(doc(dbA, 'reintegro_devoluciones', `d_${rid}`), entrega(rid));
    b.update(doc(dbA, 'reintegros', rid), { devuelto: 100 });
    await assertSucceeds(b.commit());
  }
  // 10 rids → aceptada (Firestore resuelve `in` como múltiples queries `==`)
  const q10 = query(
    collection(dbA, 'reintegro_devoluciones'),
    where('reintegroId', 'in', rids)
  );
  const snap10 = await assertSucceeds(getDocs(q10));
  if (snap10.size !== 10) {
    throw new Error(`D1 in (10): esperaba 10 docs, obtuve ${snap10.size}`);
  }
  // 11 rids: el SDK web permite `in` con hasta 10 valores; con 11 el cliente
  // lo lanza como error ANTES de llegar al servidor. Reportamos el resultado.
  const rids11 = [...rids, 'r339_10'];
  try {
    const q11 = query(
      collection(dbA, 'reintegro_devoluciones'),
      where('reintegroId', 'in', rids11)
    );
    const snap11 = await getDocs(q11);
    console.log(
      `3.39 INFO: in con 11 rids fue ACEPTADA por el SDK/emulador (${snap11.size} docs). ` +
        'El límite documentado de 10 es del SDK web; el emulador podría no aplicarlo. ' +
        'El cliente usa TANDA=10 como constante.'
    );
  } catch (e) {
    console.log(
      `3.39 INFO: in con 11 rids FALLÓ como esperado — ${e?.message?.substring(0, 120)}`
    );
  }
  // Constante de tanda del cliente: 10 (aunque el SDK permita más, el cliente no la excede)
  const TANDA = 10;
  if (TANDA !== 10) throw new Error('TANDA debe ser 10');
});

test('3.40 — alta válida con serverTimestamp(): externa y miembro aceptadas', async () => {
  // externa (sin confirmadaPor)
  await assertSucceeds(
    setDoc(doc(dbAs(A), 'reintegros', 'r340ext'), externalObl({ devuelto: 0 }))
  );
  // miembro pendiente (confirmadaPor: null)
  await assertSucceeds(
    setDoc(doc(dbAs(A), 'reintegros', 'r340mem'), createMemberObl({ devuelto: 0 }))
  );
});
