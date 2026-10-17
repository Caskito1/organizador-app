# EVIDENCIA - Subetapa 4.2 (Alta de generación) · AppFinanciera

> Fecha de ejecución: 17/10/2026 · Rama `staging` · Base: `6519dda` (4.1).
> **Cero cambios de reglas en 4.2** (`firestore.rules` intacto, igual al de 4.1).
> **Nada desplegado:** sin push de reglas/índices, sin promoción a `main`.
> **Segundo lote (mismo día):** tras la prueba funcional del usuario se
> aplicó un lote único de ajustes (§3.2) — diseño del modal, rediseño de
> `/reintegros`, correcciones de código y nuevas verificaciones.
> **Tercer lote / cierre (mismo día, 17/10/2026):** el usuario aprobó 4.2
> con un último lote de ajustes (§3.4) y la decisión de fondo de **sin
> confirmación bilateral** — 4.6 eliminada, cambios de reglas registrados
> pero NO ejecutados (§9).

## 1. Entorno — comandos exactos (emuladores + siembra + dev)

El flujo se ejecuta en **dos terminales** (PowerShell) desde la carpeta de la
aplicación (`AppFinanciera/`). **El `--project` es obligatorio**: `firebase.json`
tiene `"singleProjectMode": true` y la app habla con `finanzas-app-1c5f6`
(`.env.local`); con otro project id el emulador rechaza todas las requests.

```powershell
# Terminal 1 — emuladores (SIEMPRE primero; la siembra apunta a ESTA sesión)
cd "C:\Users\Usuario\Desktop\Proyectos Personales\opencode-AppFinanciera\AppFinanciera"
npx firebase emulators:start --only firestore,auth --project finanzas-app-1c5f6
```

```powershell
# Terminal 2 — siembra + dev
cd "C:\Users\Usuario\Desktop\Proyectos Personales\opencode-AppFinanciera\AppFinanciera"
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
$env:AUTH_EMULATOR_HOST = "127.0.0.1:9099"
npm run seed:emulator
npm run dev
# Login: http://localhost:3000/login
```

Notas:

- **Emulator UI (lote 3):** `firebase.json` habilita la UI en
  **http://127.0.0.1:4000** (Firestore + Auth) — arranca junto con los
  emuladores de la Terminal 1. Verificación:
  `Invoke-WebRequest http://127.0.0.1:4000` → **200**.
- `npm run seed:emulator` = `node scripts/seed-emulator.mjs`. **Aborta con exit 1
  si no detecta `FIRESTORE_EMULATOR_HOST`** (guarda dura: nunca escribe contra el
  proyecto real) y también si el host no es `127.0.0.1`/`localhost` (guarda del
  lote 3) o si los emuladores no responden en 8080/9099.
- **Los emuladores NO persisten datos entre sesiones:** si reiniciás la
  Terminal 1, volvé a correr la siembra en la Terminal 2 (verificado en esta
  ejecución: cada arranque arrancó sin usuarios).
- La siembra escribe con las **`firestore.rules` REALES del repo** (lee el
  archivo y las carga vía rules-unit-testing): si la siembra pasa, los datos son
  legales bajo las reglas.
- `next dev` carga `.env.development.local, .env.local` (log del dev server);
  `next build` cargó **solo** `.env.local` (log del build) — ver §2.

### 1.1 Credenciales sembradas (emulador de Auth)

| Rol | Email | Contraseña |
|---|---|---|
| Registrador | `registrador@demo.local` | `Prueba-Registrador-2026` |
| Contraparte | `contraparte@demo.local` | `Prueba-Contraparte-2026` |

Datos sembrados (Firestore, bajo rules):

- `users/<uid-Registrador>` → displayName «Ana Registradora»
- `users/<uid-Contraparte>` → displayName «Bruno Contraparte»
- `groups/grupo-prueba-42` → «Grupo de prueba», `members` = ambos uids

Efecto: el selector de contraparte del modal resuelve al miembro del grupo
(Miembro = caso de 2); con **ningún grupo o grupo de un solo miembro** el
selector ofrece **solo «Persona externa»** (comportamiento pedido).

### 1.2 Login: la app usa SOLO email/password (no hay Google)

`app/login/page.jsx` usa únicamente `signInWithEmailAndPassword`. **No existe
login con Google en la app** → el popup simulado del Auth emulator no aplica.
Verificado por REST contra el emulador con las credenciales de §1.1:
`signInWithPassword` → **OK** (uid del Registrador coincide con el sembrado).

### 1.3 Vercel Preview: proyecto real de Firebase

Los deployments de **Preview de Vercel usan el proyecto REAL de Firebase**
(`finanzas-app-1c5f6`): la flag `NEXT_PUBLIC_USE_EMULATOR` no existe en Vercel y
además requiere `NODE_ENV === 'development'` (§2). **Si probás login en un
Preview, el dominio del Preview** (p. ej.
`<app>-git-<rama>-<usuario>.vercel.app` y `<app>-<usuario>.vercel.app`) **debe
estar en Firebase Console → Authentication → Settings → Dominios autorizados**,
sino el login falla con «unauthorized domain».

## 2. Flag del emulador (`NEXT_PUBLIC_USE_EMULATOR`)

- **Dónde vive:** `.env.development.local` (ya creado; **gitignored** — `.env*`
  está en `.gitignore`) con `NEXT_PUBLIC_USE_EMULATOR=true`.
- **Dónde actúa:** `lib/firebase.js` conecta Firestore (127.0.0.1:8080) y Auth
  (`http://127.0.0.1:9099`) con guarda **DOBLE**:
  `NODE_ENV === "development" && NEXT_PUBLIC_USE_EMULATOR === "true"`.
- **Por qué no afecta build ni Vercel (doble blindaje):**
  1. `.env.development.local` solo la carga `next dev` (el build del 17/10
     imprimió `Environments: .env.local` — sin la flag).
  2. Aunque estuviera presente, el build (`NODE_ENV=production`) no cumple la
     segunda condición → la conexión al emulador queda fuera del bundle de
     producción (código muerto eliminado).
- **Puertos/rules:** `firebase.json` ya definía firestore 8080, auth 9099,
  `singleProjectMode` y `"rules": "firestore.rules"` → **el emulador arranca con
  las rules del repo** y la UI se prueba bajo reglas reales.
- Guarda anti-doble-conexión con hot-reload (`globalThis.__appFinEmulatorConnected`).
- **Aviso en consola (ajuste 11):** al conectar aparece
  `[EMULADOR] Firestore y Auth conectados a los emuladores locales …` —
  cualquier ventana abierta con ese log NO es producción.
- **PWA deshabilitada en development (verificado):** `next.config.mjs` usa
  `disable: process.env.NODE_ENV === "development"` y el log del `next dev`
  imprimió `[PWA] PWA support is disabled` — el service worker no interfiere
  con el smoke local.
- **Al alternar emulador ↔ Firebase real:** conviene probar en una ventana de
  incógnito o limpiar los datos del sitio. El `localStorage` conserva la
  sesión del emulador (uid/token locales) y puede confundir el login o las
  vistas al volver a producción.

## 3. Alcance implementado (4.2)

| Archivo | Qué |
|---|---|
| `lib/firebase.js` (edit) | Conexión a emuladores con guarda doble (§2) + `console.warn("[EMULADOR] …")` (ajuste 11) |
| `.env.development.local` (nuevo, gitignored) | `NEXT_PUBLIC_USE_EMULATOR=true` |
| `app/agregar/components/reintegros/ReintegroModal.jsx` (nuevo) | Modal de alta **un paso** (§9.3): tipo/sentido, **un solo selector «¿Con quién?»** (unión de miembros + externa), picker «¿En qué grupo?» solo si hay varios compartidos, título, monto (tope 12 dígitos), detalle, fecha de hoy (no editable), **checkbox «Me entró dinero»** solo por_devolver (deriva movimientoInicial), nota «reintegros por fuera de Gastos/Ingresos», timeout con bloqueo de campos y redirect montado-guarded; **lote 3:** aviso de nombre **solo con `null`** (no con `undefined` cargando) + `window.confirm` al cerrar con intento en vuelo tras timeout (`enVueloRef`) |
| `app/agregar/components/reintegros/hooks/useReintegroModal.js` (nuevo) | Estado + rid único + unión de miembros + groupId deducido + nombres R-5 **solo de docs existentes** (null si no; undefined = cargando, sin aviso) + movimientoInicial derivado + canSubmit con nombre resuelto (ajustes 1/2/8/9/5a) |
| `app/agregar/components/reintegros/helpers/submitReintegro.js` (edit) | `rid` **opcional** como parámetro + **normalización de contraparteUid** (ajuste 6): `''`/`null`/`undefined` → `null`; tipos no-string → `VALIDACION` sin escritura |
| `app/reintegros/page.jsx` (nuevo) | Balance de stock Préstamos/Deudas (estética /gastos), pestañas Activos/Saldados con acordeones, sección «Dinero del mes» solo lectura con selector de mes — **solo lectura** (acciones: 4.3+); **lote 3:** **sin etiqueta «Sin confirmar»** (decisión 17/10/2026) + botón **«Reintentar»** en la caja de error |
| `app/reintegros/hooks/useReintegros.js` (edit) | **Reintento de suscripción SOLO ante `unavailable`**, backoff 1s→15s con **tope de 5 intentos**, campo `reintentando` (ajuste 12); **lote 3:** `reintentar()` manual (`retryNonce` en deps del effect) |
| `app/agregar/page.jsx` (edit) | Sección «Reintegros» + botón que abre el modal; **render condicional** (`{modalReintegro && …}` — montaje por apertura); **sin tocar Transferencias** |
| `firebase.json` (edit) | **Lote 3:** Emulator UI habilitada en puerto **4000** (`"ui": { "enabled": true, "port": 4000 }`) |
| `scripts/seed-emulator.mjs` + `npm run seed:emulator` (nuevo) | Siembra con guarda `FIRESTORE_EMULATOR_HOST` **y de host local** (`127.0.0.1`/`localhost`) (§1); **lote 3:** `displayName` al crear las cuentas en Auth (`accounts:signUp` + `accounts:update` best-effort en cuentas previas) |

### 3.1 Decisiones de UX/robustez pedidas

- **Monto:** input `type="text"` que **quita no-dígitos** y muestra formato
  **sin decimales** (`es-AR`, miles con «.»); se envía `Number` entero (reglas
  `is int` de 4.1).
- **rid único:** se genera **una vez al abrir el modal** (lazy state) y pasa a
  `submitReintegro({ rid })`. Si un intento por timeout terminó commiteando, el
  reintento escribe sobre el **mismo doc** — nunca duplica (y si el doc ya
  existe, las reglas rechazan el re-write: el modal lo detecta vía lectura y
  redirige igual).
- **Botón deshabilitado mientras guarda** (`disabled` + «Guardando…»).
- **Timeout de UI ~15 s** → mensaje de reintento; la transacción en curso
  **no se cancela**: si más tarde tiene éxito, se redirige **solo si el
  modal sigue montado** (guard con `useRef` + cleanup). Tras el timeout los
  **campos quedan bloqueados** (el reintento reutiliza el mismo rid con los
  mismos datos; si el primer intento llegó, se conserva ese registro) y el
  botón sigue habilitado para reintentar.
- **Selector de contraparte (ajuste 1):** un SOLO selector con la unión de
  miembros de todos los grupos del usuario (dedup, sin el propio uid) +
  «Persona externa». El groupId se DEDUCE: 1 grupo compartido → ese; varios →
  picker «¿En qué grupo?» (obligatorio); externa → null; sin miembros →
  solo externa.
- **Movimiento inicial derivado (ajuste 2):** sin selector manual.
  `por_cobrar` → `salida`; `por_devolver` → `ninguno` por defecto, con
  checkbox «Me entró dinero (efectivo o transferencia)» → `entrada`.
  El texto de ayuda aclaraba que los reintegros van **por fuera** de Gastos
  e Ingresos. **Sin cambios de reglas/esquema**: el valor persistido sigue
  siendo uno de `['ninguno','salida','entrada']`.
- **Error mapping (ajuste 7):** `ReintegroError` a mensajes; **solo**
  `unavailable`/`deadline-exceeded` → «No hay conexión…»;
  `failed-precondition`/`aborted` → mensaje **genérico** (y el handler
  loguea `e.code` en consola: `console.error("[ReintegroModal]", code, err)`).
- **Nombres (ajuste 8):** para miembros, `canSubmit` exige nombre
  **resuelto** (doc `users/<uid>` existente con `displayName` o email); sin
  doc → aviso en rojo y bloqueo. **Nunca se persiste** `uid.slice+"..."` ni
  `""` como `contraparteNombre`; la normalización en el helper (ajuste 6)
  garantiza `contraparteUid: null` para externas (H14).
- **Monto (ajuste 9):** tope de **12 dígitos** (además de enteros > 0).

### 3.2 Ajustes del lote 2 del usuario (17/10/2026) — mapa 1…13

| # | Pedido | Estado / dónde |
|---|---|---|
| 1 | Un solo selector «¿Con quién?» + groupId deducido | `useReintegroModal.js` (unión, `gruposCompartidos`, `groupId` memo) + `ReintegroModal.jsx` |
| 2 | Sin selector de movimiento inicial; derivado + checkbox «Me entró dinero» | `useReintegroModal.js` (`movimientoInicial` memo) + checkbox en el modal |
| 3 | Header tipo balance (Préstamos / Deudas: cantidad, monto total, pendiente) | `page.jsx` §Balance (card estilo `TotalMesCard`); stock sobre abiertas, sin filtro de mes |
| 4 | Pestañas Activos/Saldados + acordeones Préstamos/Deudas (estilo /gastos), filas con contraparte, título, monto, saldado, pendiente, estado, fecha, «Sin confirmar» | `page.jsx` (importa `Acordeon` de /gastos; Saldados = liquidadas + condonadas con etiqueta que las distingue; eliminadas fuera) |
| 5 | Sección colapsable «Dinero del mes» con selector de mes (solo lectura) | `page.jsx` + `MonthSelectorModal` de /gastos; usa `entradasReintegros`/`salidasReintegros` del hook (I-8) |
| 6 | `contraparteUid` null con test para `''`/`null`/`undefined` | `submitReintegro.js` + **H14** en el harness (+ tipo no-string → `VALIDACION`) |
| 7 | Errores de conexión: solo `unavailable`/`deadline-exceeded`; genérico + log para `failed-precondition`/`aborted`; redirect tras timeout solo si montado; campos bloqueados tras timeout | `ReintegroModal.jsx` |
| 8 | `canSubmit` exige nombre resuelto; nunca persistir fallbacks | `useReintegroModal.js` (nombre = doc existente o null) |
| 9 | Monto tope 12 dígitos | `useReintegroModal.js` (`slice(0,12)`) |
| 10 | Confirmar render condicional del modal | `app/agregar/page.jsx:172` → `{modalReintegro && (<ReintegroModal …/>)}` — montaje por apertura; **dos altas seguidas** en navegador queda para tu prueba (cada apertura genera un rid nuevo y limpia el estado) |
| 11 | `console.warn("[EMULADOR] …")` + PWA off en dev + nota ventana incógnito | `lib/firebase.js`; verificado en `next.config.mjs` + log del dev (§2) |
| 12 | Reintento de suscripción solo `unavailable`, con tope, sin loop; limpieza de timer | `useReintegros.js` (`MAX_REINTENTOS = 5`) |
| 13 | EVIDENCIA: saldar/editar = 4.3, confirmación = 4.6; saldado solo externo hasta 4.6; I-8 | §3.3 + §6 de este documento |

### 3.3 Tabla pieza → subetapa (lo que 4.2 NO implementa)

| Pieza | Subetapa | Nota |
|---|---|---|
| Alta de obligación (modal un paso, rid único, timeout) | **4.2** | Implementado y probado (§4) |
| `/reintegros`: balance de stock, pestañas, acordeones, «Dinero del mes» (TODO leído, sin acciones) | **4.2** (solo lo pedido en el lote 2) | Las `sections/` de 4.3 (`ReintegrosHeader`, `PendientesSection`, `CerradosSection`) pueden reemplazar/absorber este marcado al implementarse |
| Botón «Reintegro» en `/home` (entrada rápida) | **4.3** | No implementado |
| Pagar / **saldar** / editar obligación (`DevolucionModal`, `submitDevolucion` en UI, edición D-8) | **4.3** | La UI de pago no existe: hasta 4.3 **ninguna** obligación se salda desde la app |
| Confirmación bilateral (`confirmadaPor`) | ~~4.6~~ **ELIMINADA 17/10/2026** | Sin confirmación (§9.1). El lote de reglas que retira la guarda de entregas y el chequeo `SIN_CONFIRMAR` es el **primer paso de la próxima sesión, antes de 4.3**; **mientras tanto ninguna obligación de MIEMBRO puede saldarse** (reglas + helper), aunque ya no se muestre el label. Externas: sin cambios |
| Condona / eliminar | **4.3-bis** | No implementado |
| `ResumenMesCard`, agrupación/listado por mes, métricas mensuales | **4.4** | «Dinero del mes» (4.2) es solo lectura y no agrupa la lista; **decisión 17/10/2026:** 4.4 la **absorbe** dentro de `ResumenMesCard` (sin selector duplicado — PROPUESTA §1.5/§11 fila 4) |

### 3.4 Lote 3 — ajustes de cierre (17/10/2026)

| # | Pedido | Estado / dónde |
|---|---|---|
| 1 | Botón «Reintentar» en `/reintegros` (visible si `error && !reintentando`) | `useReintegros.js` (`retryNonce` en deps del effect + `reintentar()`) + botón en la caja de error de `page.jsx` |
| 2 | Siembra: validar host `127.0.0.1`/`localhost`; opcional: `displayName` en Auth | `seed-emulator.mjs` (guarda extra tras la de env + `displayName` en `accounts:signUp` y `accounts:update` best-effort en cuentas previas) |
| 3 | Emulator UI en :4000 + documentar en §1 + reiniciar y re-sembrar | `firebase.json` (`"ui": { "enabled": true, "port": 4000 }`); §1; reinicio + siembra + verificación UI 200 y `/login` 200 al cierre |
| 4a | `miembroSinNombre` solo si `=== null` (undefined = cargando, sin aviso rojo) | `ReintegroModal.jsx` + comentario explícito en `useReintegroModal.js` |
| 4b | `uidNombre` con el mismo origen que el resto de la app | **Verificado, sin cambio de código:** el modal usa la misma cadena que `submitTransferencia.jsx:13-16`, `submitIngreso.js`, `submitCompra.js` y `submitUnico.js` (`user.displayName \|\| email-prefix \|\| "Usuario"`); `AuthContext` expone el usuario auth crudo. Nota: en el emulador las cuentas ahora se crean con `displayName` en Auth (pedido 2); antes solo el doc `users/` lo tenía |
| 4c | Aviso al cerrar si hay intento en vuelo tras timeout | `ReintegroModal.jsx` (`enVueloRef` + `window.confirm` en el backdrop) |
| 5 | EVIDENCIA: §3.4, gates re-ejecutados, §9 | este archivo |
| 6 | Quitar «Sin confirmar» de `FilaObl`; obligaciones de miembro cuentan en el balance de ambas partes | `page.jsx` (var `sinConfirmar` + span eliminados; decisión del usuario 17/10/2026 — §9.1) |
| 7 | Sección «Estado al cierre de sesión…»: sin confirmación, qué cambia (NO ejecutado), decisiones de permisos | §9 de este documento |

## 4. Verificaciones (17/10/2026 — re-ejecutadas al cierre, lote 3)

| Gate | Resultado |
|---|---|
| `npm run lint` | **Baseline exacto**: 4 problemas (2 errores + 2 warnings pre-existentes: `useIngresos:39`, `GroupContext:17`, `HomeHeader` img, `page.js` deps) — **0 nuevos** (re-verificado tras los lotes 2 y 3) |
| `npm run build` | **EXIT 0**; `Environments: .env.local` (sin la flag); ruta `/reintegros` generada (re-verificado tras los lotes 2 y 3) |
| `npm run harness:reintegros` | **20/20 PASS** (log: `temp/opencode/HARNESS-4.2-batch3.log`) — 19 de 4.1 + H14 |
| `npm run test:rules` | **44/44 PASS** (log: `temp/opencode/RULES-4.2-batch3.log`) — sin cambios en reglas |
| Smoke emuladores + siembra (lote 3, con UI :4000) | Emuladores en 8080/9099/4000; siembra **exit 0** (cuentas nuevas en el emulador reiniciado) |
| Smoke UI Emulator | `http://127.0.0.1:4000` → **HTTP 200** |
| Smoke dev | `/login` en `http://localhost:3000` → **HTTP 200** |
| Smoke Auth | `signInWithPassword` con credenciales sembradas → **OK** (§1.2) |

Notas de los gates (procedimiento vigente en los lotes 2 y 3):

- Los gates con `emulators:exec` (harness y reglas) **necesitan el puerto 8080
  libre**: para correrlos se detuvo el emulador de la sesión de prueba, se
  ejecutaron en secuencia y luego se **restauró** el entorno del usuario
  (emuladores `finanzas-app-1c5f6` + siembra exit 0 + dev en `/login` 200).
- **H14 aprendió el comportamiento de las reglas al leer docs inexistentes:**
  `allow get` de `reintegros` evalúa `resource.data.participantes` sin
  null-guard → leer un doc inexistente devuelve `permission-denied` con
  «Null value error» (**sin leak de existencia**, mismo criterio que H12).
  Por eso el chequeo «sin escritura residual» del caso de tipo inválido se
  hace con acceso **rules-disabled** (`testEnv.withSecurityRulesDisabled`),
  no con `getDoc` bajo reglas.
- **Dos altas seguidas en la misma sesión** (pedido 10): el render
  condicional garantiza un montaje nuevo por apertura (estado y `rid`
  frescos); la prueba funcional de dos altas consecutivas en el navegador
  queda para tu revisión en Local (§1).

Limitación de esta evidencia: la prueba **funcional en navegador** (abrir el
modal, elegir contraparte, dar de alta y ver el redirect con la lista) queda
para la revisión del usuario en Local (§1), como exige el «Done» de la
subetapa. Lo automatizable aquí quedó cubierto por los gates + smoke.

## 5. Hallazgos / decisiones con estado

- **H-a — ACEPTADO POR EL USUARIO (17/10/2026).** Registro vigente:
  `EVIDENCIA-4.0.md` §5 (referenciado desde `EVIDENCIA-4.1.md` §3, caso H8).
- **H-e — ACEPTADO POR EL USUARIO (17/10/2026).** Registro vigente:
  `EVIDENCIA-4.0.md` §6.
- **Costo de lecturas de D1** (1 `get()` de reglas por doc devuelto):
  **estimación NO medida** — registro vigente: `EVIDENCIA-4.0.md` §4.
- **Concurrencia NO verificada en producción:** registro vigente:
  `EVIDENCIA-4.1.md` §3.1.

(Los cuatro siguen donde estaban tras el revert de la sección de pendientes de
`EVIDENCIA-4.1.md`; H-a y H-e pasan a «aceptados» con esta fecha.)

### 5.1 El emulador NO verifica (registro explícito)

- **Concurrencia real:** el emulador no reproduce la contención del servicio
  gestionado (dos escritores compitiendo por el mismo doc). H5a/H5b prueban la
  **semántica** del emulador, no el conflicto real de producción.
- **Índices reales:** el emulador **no usa los índices compuestos**: una query
  que funcionaría acá puede fallar en producción con `failed-precondition`
  (índice faltante). Los índices se validan en la ventana de despliegue (§6).
- **Dispositivo/offline reales:** el emulador no simula pérdida de red
  (H6 omitido, ver EVIDENCIA-4.1 §10).

## 6. Política de promoción — 4.2 NO debe promoverse sola a `main`

**4.2 sola NO debe promoverse a Producción** (`push staging:main`), porque:

- **sin 4.3 no hay pago:** no existe `DevolucionModal`/`submitDevolucion` en la
  UI → una obligación creada **no puede saldarse** desde la app; y
- **sin el lote de reglas de la confirmación las obligaciones de MIEMBRO
  quedan bloqueadas:** las reglas actuales exigen `confirmadaPor != null`
  antes de crear entregas y el helper `submitDevolucion` aplica
  `SIN_CONFIRMAR` — **4.6 fue eliminada (17/10/2026)** y ese lote de reglas
  (primer paso de la próxima sesión, antes de 4.3, con diff y tests) es el
  que lo retira (§9.1). **Mientras tanto el saldado solo funciona sobre
  obligaciones EXTERNAS** (y ni eso desde la UI: la pantalla de pago llega
  con 4.3 — ver tabla §3.3).

Si el usuario aprueba **promover antes** (excepción), es **condición previa
obligatoria** poner el botón «Reintegro» de `/agregar` **detrás de una variable
de entorno de funcionalidad** (p. ej. `NEXT_PUBLIC_ENABLE_REINTEGROS`, apagada
por defecto en Producción). **En 4.2 esa variable NO se implementó** (no hizo
falta: no hay promoción) — se documenta aquí como requisito de cualquier
promoción prematura.

## 7. Checklist de ventana de despliegue (para cuando 4.3+ promueva a Producción)

Ejecutar en orden; **detenerse ante cualquier desvío**:

1. **Diff Bloque A vs consola ESE día** (`firestore.rules` §1: SHA-256
   `9769979CD0EDEC03948C80D3CB2EC00191334E070CD431F2C69B092865C57792`):
   si la consola difiere de lo esperado (alguien tocó reglas), **parar** y
   renegociar el diff antes de tocar nada.
2. **Backup nuevo** de las reglas de consola (copiar texto completo y guardarlo
   con fecha; el backup de referencia de 4.1:
   `temp/opencode/rules-consola-backup-2026-10-16.txt`).
3. **Índices PRIMERO:** desplegar `firestore.indexes.json` (Firestore →
   Composite indexes) y **esperar a que figuren `Enabled`** antes de tocar
   reglas (así ninguna query dependiente se rompe en la ventana).
4. **Reglas después:** aplicar el bloque nuevo en consola y **repetir el diff**
   contra el texto aprobado (solo los cambios esperados).
5. **Después → `staging` → `main`:** push a `staging`, revisión, aprobación
   explícita y `git push origin staging:main` solo fast-forward; Vercel
   despliega Producción automáticamente.
6. **Humo en Producción** con las **cuentas reales de test**, conceptos
   rotulados **«PRUEBA»**: alta ambos sentidos + lectura por la contraparte +
   (desde 4.3) una devolución. **Borrado manual desde la consola** de los docs
   «PRUEBA» (las reglas prohíben el delete al cliente; la consola es admin).
7. **Plan de rollback:** (a) reglas → restaurar el backup del paso 2 pegando el
   texto en consola; (b) código → Vercel: promover el deployment anterior; (c)
   índices → se quedan (inofensivos, solo cuestan almacenamiento); (d) datos
   «PRUEBA» → borradelos desde consola.

## 8. Archivos tocados en 4.2 (resumen)

- **Nuevos:** `app/agregar/components/reintegros/ReintegroModal.jsx` ·
  `app/agregar/components/reintegros/hooks/useReintegroModal.js` ·
  `app/reintegros/page.jsx` · `scripts/seed-emulator.mjs` · `EVIDENCIA-4.2.md`
- **Editados:** `lib/firebase.js` · `package.json` (+`seed:emulator`) ·
  `firebase.json` (UI :4000) · `app/agregar/page.jsx` ·
  `app/agregar/components/reintegros/helpers/submitReintegro.js` ·
  `app/reintegros/hooks/useReintegros.js` ·
  `tests/harness/reintegros.harness.test.mjs` (+H14)
- **No tocados:** `firestore.rules` (0 cambios en 4.2 completa) · `firestore.indexes.json` ·
  bloques de Transferencias · `/home` · `app/reintegros/services/subscribeReintegros.js`
  (sin cambios en ningún lote)
- **Gitignored (no commiteables):** `.env.development.local` ·
  `public/sw.js` y `public/workbox-*.js` (pre-existentes, fuera de 4.2)
- **Commits al cierre (17/10/2026):** uno de **código** (lote 3 + 4.2) y otro de
  **documentación** (`EVIDENCIA-4.2.md`), ambos sobre `staging`; docs de planificación
  (`PROPUESTA-ETAPA-4.md` §11, `HANDOFF-ETAPA-4.md`) commiteados en el repo padre.
  Push a `origin/staging` (Preview). **Sin push a `main`** (flujo de ramas).

## 9. Estado al cierre de sesión 17/10/2026 y próximos pasos

### 9.1 Decisión: sin confirmación bilateral (17/10/2026)

El usuario decidió que **el otro miembro NO confirma las deudas**: la
confirmación bilateral (PO-4, subetapa 4.6) queda **ELIMINADA** (sin
renumeración: era la última; la secuencia termina en **4.5**).

**Ejecutado en este lote (UI/docs):** etiqueta «Sin confirmar» retirada de
`/reintegros` (`app/reintegros/page.jsx`: var `sinConfirmar` + span); las
obligaciones de miembro **cuentan en el balance de ambas partes** y se
presentan como cualquier otra.

**Registrado, NO ejecutado — el primer paso de la próxima sesión, ANTES de
4.3, es el lote de reglas que retira la confirmación, con diff y tests para
aprobación del usuario** (las reglas que se desplieguen a Producción serán
las posteriores a ese lote):

- `firestore.rules` — guarda de entregas
  `confirmadaPor != null || contraparteUid == null` → se retira.
- `firestore.rules` — rama (g) de confirmación → se retira (tests 3.20).
- `firestore.rules` — condición H-c de la rama (c) → pasa a **moot** → se
  retira (test 3.25).
- `firestore.rules` — `create`: `confirmadaPor` exigido en el alta de miembro
  → se retira (tests 3.9/3.40 y shape del alta).
- `submitReintegro.js:122-125` — el alta escribe `confirmadaPor: null` → se
  retira (harness H1 / 1a / 1b).
- `submitDevolucion.js:73-78` — chequeo `SIN_CONFIRMAR` → se retira (harness
  H3b).
- Extensión `['confirmacion']` en `eventos` → **sin objeto**; la lista D-3
  se mantiene cerrada en 4 tipos.

**Efecto visible mientras tanto:** los pagos de obligaciones de **MIEMBRO**
siguen bloqueados (reglas + helper) aunque ya no se muestre el label;
externas sin cambios. `PROPUESTA-ETAPA-4.md` quedó anotado (§1.2/§1.6/§1.8
ELIMINADA/§2.5 SUPERADO/§5 SUPERADO + nueva **§11** con todas las decisiones
del 17/10); `HANDOFF-ETAPA-4.md` actualizó D-11a/D-11b y la secuencia (§4).

### 9.2 R-4 y H-e

- **R-4** (doble registro de la misma obligación real): la mitigación por
  confirmación se retira → queda **solo convención de uso** documentada
  (PROPUESTA §5.4, registro histórico).
- **H-e** (obligación impuesta a un tercero sin vínculo): sin confirmación,
  la contraparte **no tiene ningún veto** — no puede aceptar, rechazar ni
  ocultar la obligación que le crea el registrador, y **no se le avisa si el
  registrador edita el monto** (la edición queda solo en la bitácora).
  **H-e sigue PENDIENTE ABIERTO** (`EVIDENCIA-4.0.md` §6): debe resolverse
  antes de abrir la app al público.

### 9.3 Decisiones de permisos — CONFIRMADAS por el usuario (17/10/2026)

| Decisión | Resolución |
|---|---|
| Quién puede registrar pagos | **Cualquiera de los dos** (efectivo tras el lote de reglas de §9.1) |
| Quién puede editar el monto | **Solo el registrador, con `devuelto == 0`** (rama (c) vigente; la condición H-c pasa a moot en ese lote) |
| Condonar | **Como está hoy** (C1: acreedor según su vista) hasta 4.3-bis |
| Eliminar | **Como está hoy** (E1: solo registrador) hasta 4.3-bis |

### 9.4 Commits de cierre

- **Código** (lote 3 + 4.2 completo): commit sobre `staging` (nunca push a
  `main`); excluye `public/sw.js`, `public/workbox-*.js` y `.env*`.
- **Documentación:** `EVIDENCIA-4.2.md` (este archivo, repo de la app) +
  `PROPUESTA-ETAPA-4.md` / `HANDOFF-ETAPA-4.md` (repo padre), commit
  separado del de código.
- Push a `origin/staging` (despliegue Preview de Vercel). La promoción a
  `main` requiere aprobación explícita aparte (§6) — 4.2 sola NO se
  promueve; además ahora falta el lote de reglas de §9.1 y 4.3.
