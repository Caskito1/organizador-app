// scripts/seed-emulator.mjs
// Siembra los EMULADORES (Auth + Firestore) con los datos mínimos para
// probar 4.2 en Local: 2 usuarios de prueba + 1 grupo de 2 miembros
// (selector de contraparte funcional).
//
// REGLA DURA: aborta si no detecta FIRESTORE_EMULATOR_HOST o si el host no es
// 127.0.0.1/localhost — nunca escribe contra el proyecto real. Las escrituras
// van por las rules-unit-testing contexts (con firestore.rules REALES del repo):
// si la siembra pasa, los datos son legales bajo las reglas.
//
// Uso (ver EVIDENCIA-4.2.md para el flujo completo):
//   $env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
//   $env:AUTH_EMULATOR_HOST = "127.0.0.1:9099"
//   npm run seed:emulator

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc } from "firebase/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function abort(motivo, extras = []) {
  console.error(`[seed] ABORTADO: ${motivo}`);
  for (const linea of extras) console.error(`[seed]   ${linea}`);
  process.exit(1);
}

// ─── 1) Guarda dura: sin env de emulador no se corre ─────────────────────
const fsHost = process.env.FIRESTORE_EMULATOR_HOST;
if (!fsHost) {
  abort("falta FIRESTORE_EMULATOR_HOST (nunca escribir contra el proyecto real).", [
    'En la terminal donde corra el script, exportá primero:',
    '$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"',
    '$env:AUTH_EMULATOR_HOST = "127.0.0.1:9099"',
    "Flujo completo: EVIDENCIA-4.2.md («Comandos exactos»).",
  ]);
}

const fsHostname = fsHost.split(":")[0];
const fsPort = Number(fsHost.split(":")[1] || 8080);
const authHost = process.env.AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const authBase = `http://${authHost}/identitytoolkit.googleapis.com/v1`;

// Guarda extra: el host tiene que ser local. Aunque la variable esté seteada,
// un host remoto (p. ej. el propio prod) jamás debe recibir la siembra.
if (!["127.0.0.1", "localhost"].includes(fsHostname)) {
  abort(
    `FIRESTORE_EMULATOR_HOST apunta a "${fsHostname}": la siembra solo corre contra 127.0.0.1 o localhost.`,
    ['Usá: $env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"'],
  );
}

// ─── 2) Los emuladores tienen que estar vivos ────────────────────────────
try {
  await fetch(`http://${fsHost}/`);
} catch {
  abort(`el emulador de Firestore no responde en http://${fsHost}/`, [
    "¿Está corriendo `firebase emulators:start` en la otra terminal?",
  ]);
}
try {
  await fetch(`http://${authHost}/`);
} catch {
  abort(`el emulador de Auth no responde en http://${authHost}/`, [
    "¿Está corriendo `firebase emulators:start` en la otra terminal?",
  ]);
}

// ─── 3) Config del proyecto desde .env.local (mismo project que la app) ──
const envLocal = path.join(ROOT, ".env.local");
if (!fs.existsSync(envLocal)) {
  abort(".env.local no existe: no hay NEXT_PUBLIC_FIREBASE_PROJECT_ID.");
}
const cfg = {};
for (const linea of fs.readFileSync(envLocal, "utf8").split(/\r?\n/)) {
  const m = linea.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) cfg[m[1]] = m[2];
}
const projectId = cfg.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) {
  abort("NEXT_PUBLIC_FIREBASE_PROJECT_ID ausente en .env.local.");
}

// ─── 4) Usuarios en el emulador de Auth (REST, siempre localhost) ────────
async function authRest(endpoint, body) {
  const key = cfg.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-key";
  const res = await fetch(`${authBase}/${endpoint}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

async function ensureUser(cuenta) {
  const creado = await authRest("accounts:signUp", {
    email: cuenta.email,
    password: cuenta.password,
    returnSecureToken: true,
    displayName: cuenta.displayName,
  });
  if (creado.ok) return { uid: creado.json.localId, nuevo: true };

  const enUso = String(creado.json?.error?.message || "").includes(
    "EMAIL_EXISTS",
  );
  if (!enUso) {
    abort(
      `el emulador de Auth rechazó ${cuenta.email}: ` +
        JSON.stringify(creado.json?.error ?? creado.json),
    );
  }

  // Ya existe: entra con la MISMA contraseña (siembra idempotente).
  const acceso = await authRest("accounts:signInWithPassword", {
    email: cuenta.email,
    password: cuenta.password,
    returnSecureToken: true,
  });
  if (!acceso.ok) {
    abort(`la cuenta ${cuenta.email} existe con OTRA contraseña.`, [
      "Borrala desde la consola del emulador de Auth (emulator UI o API)",
      "o usá otro email de prueba.",
    ]);
  }

  // Best-effort: si la cuenta previa no tenía displayName en Auth, setearlo
  // (los docs users/ ya lo tienen; esto alinea el perfil de Auth también).
  if (acceso.json?.idToken) {
    const upd = await authRest("accounts:update", {
      idToken: acceso.json.idToken,
      displayName: cuenta.displayName,
    });
    if (!upd.ok) {
      console.warn(
        `[seed] aviso: no se pudo setear displayName en Auth para ${cuenta.email}`,
      );
    }
  }
  return { uid: acceso.json.localId, nuevo: false };
}

const CUENTAS = [
  {
    rol: "Registrador",
    email: "registrador@demo.local",
    password: "Prueba-Registrador-2026",
    displayName: "Ana Registradora",
  },
  {
    rol: "Contraparte",
    email: "contraparte@demo.local",
    password: "Prueba-Contraparte-2026",
    displayName: "Bruno Contraparte",
  },
];

const creadas = [];
for (const cuenta of CUENTAS) {
  const r = await ensureUser(cuenta);
  creadas.push({ ...cuenta, ...r });
  console.log(
    `[seed] Auth: ${cuenta.rol} ${cuenta.email} → uid ${r.uid} ` +
      `(${r.nuevo ? "creada" : "ya existía"})`,
  );
}

const [registrador, contraparte] = creadas;

// ─── 5) Datos en el emulador de Firestore (con rules del repo) ───────────
const rulesSrc = fs.readFileSync(
  path.join(ROOT, "firestore.rules"),
  "utf8",
);
const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { rules: rulesSrc },
});

try {
  const dbReg = testEnv.authenticatedContext(registrador.uid).firestore();
  const dbCon = testEnv.authenticatedContext(contraparte.uid).firestore();

  // users: cada usuario escribe el SUYO (regla: uid == userId).
  await setDoc(doc(dbReg, "users", registrador.uid), {
    uid: registrador.uid,
    displayName: registrador.displayName,
    email: registrador.email,
  });
  await setDoc(doc(dbCon, "users", contraparte.uid), {
    uid: contraparte.uid,
    displayName: contraparte.displayName,
    email: contraparte.email,
  });

  // Grupo de 2 miembros: habilita el selector de contraparte por miembro.
  const GRUPO_ID = "grupo-prueba-42";
  await setDoc(doc(dbCon, "groups", GRUPO_ID), {
    name: "Grupo de prueba",
    members: [registrador.uid, contraparte.uid],
  });

  // Verificación con reglas (lectura como el Registrador):
  const grupoOk = await getDoc(doc(dbReg, "groups", GRUPO_ID));
  const userConOk = await getDoc(doc(dbReg, "users", contraparte.uid));
  if (!grupoOk.exists() || !userConOk.exists()) {
    abort("la verificación de lectura falló (grupo o users/contraparte).");
  }

  console.log("[seed] Firestore OK (bajo firestore.rules del repo):");
  console.log(`[seed]   users/${registrador.uid}`);
  console.log(`[seed]   users/${contraparte.uid}`);
  console.log(`[seed]   groups/${GRUPO_ID} (2 miembros)`);
  console.log("[seed] OK — credenciales para /login:");
  for (const c of creadas) {
    console.log(
      `[seed]   ${c.rol}: ${c.email} · contraseña ${c.password}`,
    );
  }
  console.log(
    "[seed] Nota: estas cuentas existen SOLO en el emulador de Auth; " +
      "los usuarios de prueba del proyecto real no se ven ni se tocan.",
  );
} finally {
  await testEnv.cleanup();
}
