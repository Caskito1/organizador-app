import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  connectAuthEmulator,
} from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// Emulador local (4.2): Firestore + Auth contra los emuladores del repo.
// Puertos = firebase.json ("emulators"); las rules cargadas por el emulador
// son firestore.rules del repo (el alta de 4.2 se prueba bajo reglas REALES).
//
// Guarda DOBLE (decisión 17/10/2026): solo si NODE_ENV === 'development' Y
// NEXT_PUBLIC_USE_EMULATOR === 'true'. La flag vive en .env.development.local
// (se carga SOLO en `next dev`; `next build` no la lee) y además la segunda
// condición la anula en cualquier build → build local y Vercel quedan intactos.
const USE_EMULATOR =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_USE_EMULATOR === "true";

// Guarda anti-doble-conexión: los singletons de auth/db persisten entre
// hot-reloads de `next dev`; reconectar dos veces rompe el SDK.
if (USE_EMULATOR && !globalThis.__appFinEmulatorConnected) {
  globalThis.__appFinEmulatorConnected = true;
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
  // Aviso visible en consola del dev server / navegador (ajuste 11): si la
  // app está contra emuladores, los datos NO son los de producción.
  console.warn(
    "[EMULADOR] Firestore y Auth conectados a los emuladores locales " +
      "(127.0.0.1:8080 / http://127.0.0.1:9099). Datos locales, no producción.",
  );
}
