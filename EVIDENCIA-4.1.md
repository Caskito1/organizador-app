# EVIDENCIA — Subetapa 4.1 (Modelo y servicios) · AppFinanciera

> Registro de evidencia de la subetapa 4.1. Fecha: **16/10/2026**. Base de código:
> `staging` sobre `2404140` (== `origin/staging` al iniciar; verificado). Este archivo se
> commitea junto con el resto de 4.1. **Sin commit a `main`, sin deploy, sin
> `staging→main`** — el usuario revisa y aprueba antes de cualquier promoción (AGENTS.md).

## 1. Entorno

| Componente | Versión / estado | Nota |
|---|---|---|
| Node | 20.11.1 | Runner `node:test`; flag `--experimental-detect-module` necesario para que Node detecte ESM en los `.js` del app (ver §8) |
| `firebase-tools` | 14.27.0 (devDep) | Emulador Firestore |
| `@firebase/rules-unit-testing` | 5.0.2 | `initializeTestEnvironment({ projectId: 'demo-finanzas' })` |
| `firebase` (app) | 12.12.1 | SDK del cliente (transacciones, onSnapshot) |
| Proyecto del emulador | `demo-finanzas` | **Cero escrituras en `finanzas-app-1c5f6`** |

## 2. Índices pendientes de despliegue

| Índice | Defición | Estado |
|---|---|---|
| **R1'** | `reintegros`: `participantes` (array_contains) + `createdAt` (DESCENDING) | Declarado en `firestore.indexes.json`; **NO desplegado** a `finanzas-app-1c5f6`. El emulador lo crea automáticamente. Requiere: (a) aprobación; (b) ventana de mantenimiento (Staging y Producción comparten proyecto); (c) `firebase deploy --only firestore:indexes`. |
| **D1** | `reintegro_devoluciones`: `reintegroId` (`==` / `in`) | **No requiere índice compuesto** — filtro de campo único con índice automático de Firestore. `firestore.indexes.json` queda sin cambios para D1. |

`firestore.indexes.json` NO se modificó en 4.1 (R1' ya estaba pre-aprobado en 4.0, riesgo R-2).

## 3. Harness del módulo (`npm run harness:reintegros`)

- **Resultado: 19/19 PASS.** Run archivado: `EVIDENCIA-4.1-harness.log`.
- Archivo: `tests/harness/reintegros.harness.test.mjs` (19 tests).
- Ambiente: emulador `demo-finanzas`, reglas de `firestore.rules` (con `is int` en monto, §6).
- Los helpers reales (`submitReintegro`, `submitDevolucion`, `subscribeReintegros`) se importan
  directamente desde `app/`; reciben `db` como parámetro (la instancia del emulador).

| Caso | Test | Qué verifica | Resultado |
|---|---|---|---|
| 1 | H1 | `submitReintegro` ambos sentidos: shape exacto, `participantes`, `confirmadaPor:null` solo miembro / ausente en externo, `devuelto:0`, `gastoVinculadoId:null`, `createdAt` Timestamp, sin `condonacion`/`eliminacion`; evento `creacion`/`obligacion` en la misma transacción | PASS |
| 2 | H2 | Devolución parcial miembro confirmado: `devuelto` baja exactamente, saldo > 0, estado `parcial`, evento `creacion`/`entrega`, D-7 consistente | PASS |
| 2b | H2b | Devolución parcial externa: `devuelto` baja, estado `parcial` | PASS |
| 3 | H3 | Devolución completa: saldo 0, estado `liquidado`, D-7 consistente | PASS |
| 3b | H3b | Miembro sin confirmar: `submitDevolucion` lanza `ReintegroError` con code `SIN_CONFIRMAR`; **sin escritura** (ni `devuelto` ni entrega) | PASS |
| 4 | H4 | Sobrepago: lanza `SALDO_INSUFICIENTE`; `devuelto` intacto | PASS |
| 5a | H5a | Concurrencia suma > saldo: **exactamente una gana**, sin sobregiro, `devuelto == 600`, D-7 consistente. Error del perdedor: `permission-denied` (emulador) o `SALDO_INSUFICIENTE` (producción, vía retry) — ver nota §3.1 | PASS |
| 5b | H5b | Suma ≤ saldo: dos devoluciones **secuenciales** ambas ganan, `devuelto == 800`, D-7 consistente. Ver nota §3.1 | PASS |
| 6 | — | Sin red: **omitido** — el emulador no simula conectividad; `runTransaction` falla offline por diseño (ver §7). Cubierto por la UI en 4.3. | — |
| 7 | H7 | Atribución: `registradoPor=A`, `realizadoPorUid=B` (I-6: el pagador ≠ el registrador) | PASS |
| 8 | H8 | D-7 positivo (secuencia de 2 devoluciones, consistente) + **negativo H-a**: participante normal forja `devuelto` sin entrega acompañante (updateDoc directo, permitido por las reglas); `assertDevueltoConsistente` detecta la divergencia | PASS |
| 9 | H9 | No participante (C): `submitDevolucion` falla con error de permisos (transacción rechazada); sin escritura | PASS |
| 10 | H10 | Estado 100% derivado: ni la obligación ni las entregas almacenan campo `estado`; `estadoDe()` calcula correctamente | PASS |
| 11 | H11 | **Montos enteros (§5.1):** monto 0.5 rechazado en alta y entrega (cliente `MONTO_INVALIDO`) y en edit monto de obl/entrega (reglas `is int`); flujo entero 300 = 100 + 200 liquidado sin error de precisión | PASS |
| 12 | H12 | Validaciones: rid inexistente → rechaza (`NO_ENCONTRADA` si la lectura pasa, o `permission-denied` por reglas — §5.1); `realizadoPorNombre`/`fechaPago` requeridos; `sentido`/`movimientoInicial`/`uidNombre` inválidos → `VALIDACION` | PASS |
| 13 | H13 | **I-8 (§6.2):** `entradasDelMes`/`salidasDelMes` cuentan `movimientoInicial` solo si `registradoPor === uid`; la contraparte NO cuenta el movimientoInicial ajeno | PASS |
| + | HS0+HS1 | Suscripción con 0 obligaciones: emite `{ obligaciones:[], devoluciones:[] }` **sin suscribir D1 con lista vacía**; alta nueva vía helper → R1' re-emite → D1 se suscribe (1 rid) → segunda emisión con la obl nueva | PASS |
| + | HS2 | Batching TANDA: 12 obls con 1 entrega cada una → las 12 entregas traídas vía 2 tandas (10 + 2); `TANDA == 10` | PASS |
| + | HS3 | Cleanup: `unsubscribe()` no lanza errores ni deja emisiones nuevas | PASS |
| + | HS4 | Cleanup tras emitir R1' **con datos**: `unsubscribe()` no lanza errores ni deja emisiones nuevas | PASS |

### 3.1 Nota: emulador vs producción en concurrencia (H5a/H5b)

> **ADVERTENCIA (revisión 4.1):** el comportamiento concurrente en **producción NO está
> verificado**. Todo lo que sigue se observó en el emulador local; el comportamiento real
> del SDK web + backend de Firestore ante transacciones simultáneas del mismo cliente es
> **inferido de la documentación**, no medido. En particular, **el caso 5b concurrente
> (dos devoluciones simultáneas con suma ≤ saldo, ambas ganando) quedó SIN PROBAR**: el
> emulador lo resuelve con `permission-denied` para el perdedor (ver abajo), por lo que el
> harness lo prueba en modo secuencial. Si en producción el retry de optimistic locking
> permite que ambas ganen, eso deberá verificarse con datos reales antes de habilitar
> escrituras concurrentes multi-usuario (fuera del alcance de 4.1).

En el emulador, cuando dos transacciones del mismo cliente se lanzan en paralelo sobre la
misma obligación, el perdedor recibe **`permission-denied`** (las reglas evalúan el `update`
contra el estado YA GANADOR: `devuelto_nuevo > devuelto_actual` falla cuando el ganador ya
subió el acumulador). El SDK **no reintenta** un `permission-denied` (solo reintenta
`aborted`). Se infiere que en producción el mecanismo de optimistic locking devolvería
`aborted`, el SDK reintentaría, y el check de cliente (`SALDO_INSUFICIENTE`) o el éxito
(suma ≤ saldo) ocurrirían en el retry — **pero esto no se verificó**. **El invariante
observado en el emulador es: sin sobregiro, `devuelto` consistente, D-7 en cero.** H5b usa
ejecución secuencial para demostrar que dos devoluciones legítimas pueden coexistir cuando
no se pisan (el saldo las admite ambas).

## 4. Registro de escritores de `devuelto` (D-6, grep de evidencia)

| Escritor | Línea | Rol | Contexto |
|---|---|---|---|
| `submitReintegro.js` | `:51` | **`devuelto: 0`** — escritura INICIAL del acumulador al alta | `tx.set` dentro de `runTransaction`; la regla de create exige `devuelto == 0`. Es el valor de nacimiento, no un incremento. |
| `submitDevolucion.js` | `:87` | **Incremento** — `tx.update(oblRef, { devuelto: obl.devuelto + monto })` | Único incremento en toda la app. Acople exacto con la entrega creada en la misma transacción (criterio 3.8). |

Grep completo (`app/**/*.{js,jsx}`, patrón `devuelto:`):
```
app\agregar\components\reintegros\helpers\submitDevolucion.js:87: tx.update(oblRef, { devuelto: Number(obl.devuelto) + montoNum });
app\agregar\components\reintegros\helpers\submitReintegro.js:40: // devuelto:0, gastoVinculadoId:null, createdAt==request.time,   (comentario)
app\agregar\components\reintegros\helpers\submitReintegro.js:51: devuelto: 0,
```

Grep `updateDoc` sobre `reintegros` fuera de helpers: **0 coincidencias** (el único `update`
es `tx.update` dentro de `submitDevolucion`). Grep `tx.update` en la app: **1 coincidencia**
(la de `submitDevolucion.js:87`).

**Conclusión D-6 (parcial, 4.1):** `devuelto` tiene exactamente dos escritores, ambos
transaccionales y acoplados: el de nacimiento (`0` en el alta) y el de incremento (en la
devolución). `eliminarEntrega`/`editarEntrega` (4.3) agregarán sus ramas de decremento/
recalculo; el registro se re-verifica al cerrar 4.3.

### 4.1 Confirmación: `tx.update` escribe SOLO `devuelto`; mapeo de `permission-denied`

**`tx.update` parcial:** la llamada `tx.update(oblRef, { devuelto: Number(obl.devuelto) + montoNum })`
(`submitDevolucion.js:87`) es un **update parcial** de la SDK web: solo el campo `devuelto`
se modifica; el resto del doc queda intacto. Las reglas lo refuerzan con
`affectedKeys().hasOnly(['devuelto'])` en la rama (a) del update de `reintegros`
(`firestore.rules:273-278`): cualquier intento de coadular otro campo en la misma escritura
es rechazado. No hay escritura de campos derivados ni de `estado`.

**Mapeo de `permission-denied`:** `submitDevolucion` **NO mapea** `permission-denied` a un
`ReintegroError`. El `FirebaseError` de la SDK propaga **sin traducir** (code
`'permission-denied'`, message del backend). Esto es deliberado en 4.1:

- Los codes de `ReintegroError` (`CONDONADA`, `ELIMINADA`, `SIN_CONFIRMAR`,
  `SALDO_INSUFICIENTE`) son **errores de dominio** — el cliente los detecta en sus guardas
  de transacción y los lanza antes de llegar al backend.
- `permission-denied` es un **error de infraestructura/permisos** (reglas, auth, rol). El
  helper lo deja pasar crudo para que la UI de 4.3 pueda distinguirlo de un error de
  dominio y mostrar un mensaje apropiado ("sin permisos" vs "saldo insuficiente").

En la práctica, un `permission-denied` solo llega al caller en dos escenarios: (i) la
transacción pierde una carrera en el emulador (§3.1), o (ii) un no-participante intenta la
operación (H9 — cubierto por reglas, el `tx.get` inicial ya falla). En ambos casos la
ausencia de mapeo es correcta: no es un error de dominio del módulo.

## 5. Reconciliación D-7 (resultado)

`assertDevueltoConsistente(obligacion, entregas)` es una **función pura** exportada de
`app/reintegros/helpers/modelo.js`: `devuelto == Σ entregas no eliminadas`. Casos del
harness que la verifican:

| Secuencia | Resultado |
|---|---|
| H2 (parcial $300/$1000) | consistente (300 == 300) |
| H2b (parcial $200/$500 externa) | consistente (200 == 200) |
| H3 (completa $1000/$1000) | consistente (1000 == 1000) |
| H5a (concurrencia, una gana) | consistente (600 == 600) |
| H5b (dos secuenciales) | consistente (800 == 800) |
| H8 positivo (2 devoluciones) | consistente (500 == 500) |
| **H8 negativo (H-a)** | **divergente detectada** (devuelto=500, Σentregas=0) — el forge de un participante normal queda trazado por D-7 |

El hook `useReintegros` ejecuta la misma reconciliación en runtime (solo `NODE_ENV !==
'production'`) vía `console.warn`, agrupando las entregas ya suscritas por `reintegroId`
(sin query adicional).

### 5.1 Decisión: montos SIEMPRE enteros en pesos (16/10/2026)

**Contexto (hallazgo H11 original, ahora superado):** Firestore almacena `monto`/`devuelto`
como double (IEEE 754). Con montos decimales, `0.1 + 0.2 = 0.30000000000000004 > 0.3` —
una obligación de 0.3 NO admitía pagos fraccionados de 0.1 + 0.2 (el segundo se rechazaba
por cliente y por reglas; un pago único del total sí funcionaba). Verificado empíricamente
en H11 previo (16/16 PASS).

**Decisión del usuario (16/10/2026): montos SIEMPRE enteros en pesos — sin centavos.** Esto
elimina la clase entera de errores de precisión IEEE 754. Si en el futuro se admiten
centavos, la mitigación correcta es **migrar a unidad menor (centavos enteros)** — no
decimales en pesos.

Implementación en dos capas (doble barrera, consistente):

| Capa | Mecanismo |
|---|---|
| **Cliente** | `submitReintegro` y `submitDevolucion` validan `Number.isInteger(monto)` y lanzan `ReintegroError('MONTO_INVALIDO')` antes de tocar Firestore. |
| **Reglas** | `is int` en el `monto` de: (1) create de `reintegros`, (2) create de `reintegro_devoluciones`, (3) rama (c) de update de `reintegros` (edit monto de obl), (4) rama (ii) de update de `reintegro_devoluciones` (edit monto de entrega). Reemplazan los `is number` previos. |

**Verificado (H11 reescrito, 19/19 PASS):** monto 0.5 rechazado en alta (cliente), en
entrega (cliente), en edit monto de obl (reglas) y en edit monto de entrega (reglas);
flujo entero 300 = 100 + 200 liquidado sin error. Suite de reglas 3.41–3.44 (44/44 PASS)
cubre los mismos 4 negativos + positivos a nivel de reglas.

`assertDevueltoConsistente` (D-7) sigue comparando con `===` — con enteros no hay error de
representación, la comparación es exacta.

## 6. Cambios de reglas (is int en monto)

`git diff firestore.rules` → **4 cambios**, todos `is number` → `is int` en el campo `monto`
(decisión §5.1). Ninguna otra rama de reglas se tocó. La suite de reglas se re-ejecutó:
**44/44 PASS** (3.1–3.44; 3.41–3.44 son los nuevos tests de monto entero).

> **Nota:** el diff de reglas está en el working tree SIN commitear. El deploy de reglas a
> `finanzas-app-1c5f6` NO está autorizado en 4.1 (requiere aprobación + ventana; §12).

## 7. Decisión: `runTransaction` para el alta (NO `writeBatch`)

`submitDevolucion` usa `runTransaction` (necesita leer: saldo, condonación, eliminación,
confirmación). El alta (`submitReintegro`) NO necesita leer — solo dos creates — por lo que
se evaluó `writeBatch` (que encola offline, latency compensation) como alternativa.

**Decisión: `runTransaction` también para el alta.** Razón (hallazgo HS0+HS1, 16/10/2026):
`writeBatch` aplica **latency compensation local** — el `onSnapshot` de la suscripción del
propio creador ve el obl local ANTES de que el backend lo confirme. En esa ventana la query
D1 (devoluciones) se dispara y su regla `list` hace `get()` del padre en el backend, que aún
no lo ve → **error transitorio `permission-denied`** en la suscripción. `runTransaction`
commitea atómicamente en el servidor SIN compensación local: la suscripción nunca observa
estado a medio commitear. (Confirmado: al probar `writeBatch`, HS0+HS1 falló consistentemente;
con `runTransaction` pasa 19/19.)

**Coste:** offline `runTransaction` falla por diseño (Firestore no tiene cola de
transacciones) — el alta y la devolución requieren red. Es la misma limitación pre-existente
conocida en el repo (AGENTS.md: "Escrituras sin timeout en Firestore"); el módulo la hereda
y la declara aquí. La UI de 4.3 decidirá cómo manejarlo (deshabilitar con aviso, retry).

## 8. Ajuste necesario de `package.json` (flag del harness)

El harness corre bajo Node 20.11.1, que **no detecta ESM en archivos `.js`** sin
`"type": "module"` en `package.json` (los `.js` del app usan `import`/`export` y el repo no
tiene `"type": "module"` — añadirlo rompería tooling). Solución: flag
`--experimental-detect-module` en el script (disponible desde Node 20.10):

```json
"harness:reintegros": "firebase emulators:exec --only firestore --project demo-finanzas \"node --experimental-detect-module --test tests/harness/\""
```

Verificado: el flag resuelve los imports de ESM de los `.js` del app desde el `.mjs` del
harness. Es el **único** cambio de `package.json` en 4.1 (una línea). El flag es
experimental en Node 20; si el repo migra a Node ≥22 puede eliminarse (detección ESM
habilitada por defecto).

**Confirmación (revisión 4.1): el flag NO afecta build ni Vercel.** El flag vive
exclusivamente en el script `harness:reintegros`. Los otros scripts de `package.json` no lo
incluyen:

| Script | Comando | ¿Usa el flag? |
|---|---|---|
| `build` | `next build --webpack` | **NO** |
| `dev` | `next dev --webpack` | **NO** |
| `start` | `next start` | **NO** |
| `lint` | `eslint` | **NO** |
| `test:rules` | `firebase emulators:exec … node --test tests/rules/` | **NO** |
| `harness:reintegros` | `firebase emulators:exec … node --experimental-detect-module --test tests/harness/` | SÍ (único) |

Vercel ejecuta `npm run build` (o `next build`) en el build; nunca invoca
`harness:reintegros`. El flag es un artefacto 100 % local de desarrollo. `npm run build`
corrido en esta revisión: EXIT 0 (sin el flag, sin regresiones).

**Aislamiento de config (ajuste 1):** grep sobre el árbol de imports del harness
(`subscribeReintegros.js`, `modelo.js`, `submitReintegro.js`, `submitDevolucion.js`):
**0 imports de `@/lib/firebase`** (solo comentarios la mencionan). Los helpers reciben `db`
como parámetro. El harness pasa `testEnv.authenticatedContext(uid).firestore()`; la app
pasará `db` de `@/lib/firebase` en 4.2/4.3.

## 9. Propuesta: probar la UI de 4.2 en Preview sin desplegar reglas/índices a Producción

**Problema:** Vercel Preview (rama `staging`) apunta al mismo proyecto Firebase
(`finanzas-app-1c5f6`) que Producción. Las reglas y los índices son globales por proyecto:
cualquier deploy afecta a ambos entornos a la vez. La UI de 4.2 necesita las reglas de
Reintegros para funcionar, pero desplegarlas a `finanzas-app-1c5f6` requiere la ventana de
mantenimiento y la aprobación que 4.1 NO tiene.

**Propuesta (3 opciones, a decidir por el usuario):**

| Opción | Descripción | Ventaja | Desventaja |
|---|---|---|---|
| **A — Emulador local para 4.2** (recomendada) | Desarrollar y probar la UI de 4.2 en local contra el emulador `demo-finanzas` (mismo harness: reglas + índices + datos sembrados). No se toca ningún entorno compartido. | Cero riesgo para Producción/Staging; iteración rápida; datos sintéticos controlados. | No se prueba contra datos reales ni en Preview de Vercel. El usuario prueba en local. |
| **B — Proyecto Firebase separado para Staging** | Crear un segundo proyecto (p. ej. `finanzas-app-staging`) con sus propias reglas/índices; apuntar el Preview de Vercel a ese proyecto vía env vars (`NEXT_PUBLIC_FIREBASE_*`). Producción sigue en `finanzas-app-1c5f6`. | Preview real en Vercel con reglas del módulo, sin tocar Producción. | Requiere crear proyecto, habilar Auth/Firestore, reglas e índices ahí; mantener dos proyectos; migrar datos si se quiere simular el caso real. |
| **C — Ventana de mantenimiento temprana** | Desplegar reglas+índices de Reintegros a `finanzas-app-1c5f6` ANTES de terminar 4.2 (con aprobación + ventana). Staging y Producción las comparten. | Un solo proyecto; Preview funciona out-of-the-box. | Expone las colecciones nuevas a Producción antes de que el módulo esté completo (aunque `reintegros`/`reintegro_devoluciones` están vacías y solo accesibles para sus participantes — las reglas son correctas y probadas 44/44). |

**Recomendación:** Opción **A** para 4.2 (UI en local/emulador). La opción B se evalúa si el
usuario quiere demos en Vercel Preview. La opción C queda para cuando se autorice el deploy
de reglas (junto con la ventana de mantenimiento), idealmente al cerrar 4.3 (helpers
completos: editar/eliminar/condonar). Ninguna opción requiere cambios de código en 4.1.

## 10. Verificaciones de app

| Criterio | Resultado |
|---|---|
| `npm run build` | EXIT 0 (compila + genera 9 páginas; re-verificado tras revisión) |
| `npm run lint` | 2 errores + 2 warnings — **idénticos al baseline** (`useIngresos.js:39`, `GroupContext.jsx:17`, `HomeHeader.jsx` img, `page.js` exhaustive-deps). **0 errores/warnings nuevos** (los gated arrays del hook se envolvieron en `useMemo` para no sumar warnings de deps). |
| `npm run harness:reintegros` | 19/19 PASS (H1–H13 + HS0–HS4) |
| `npm run test:rules` | 44/44 PASS (3.1–3.44; `is int` en monto §6) |
| Montos enteros | Cliente `Number.isInteger` → `MONTO_INVALIDO`; reglas `is int` en 4 puntos (§5.1); H11 + 3.41–3.44 verifican negativos y positivos |
| `permission-denied` sin mapear | `submitDevolucion` propaga `FirebaseError` crudo (code `permission-denied`); NO se traduce a `ReintegroError` — es error de infraestructura/permisos, no de dominio. La UI de 4.3 distingue ambos tipos (§4.1) |
| `tx.update` parcial | Solo escribe `devuelto`; reglas lo refuerzan con `hasOnly(['devuelto'])` (§4.1) |
| Campo `detalle` vs `nota` | El esquema de `PROPUESTA-ETAPA-3.md` §3.2 nombra el campo de la entrega `nota`; la suite de reglas de 4.0 y el harness de 4.1 usan **`detalle`** (consistencia con el código ya probado y aprobado). Las reglas no restringen el nombre (create sin `hasOnly`). Se documenta la discrepancia: **`detalle` es el nombre implementado**; si se prefiere `nota`, el rename es un refactor de 1 campo (app + tests) sin impacto en reglas. |
| `createdAt` null en snapshots | `subscribeReintegros` usa `data({ serverTimestamps: 'estimate' })` en todos los docs; los filtros por mes (`enRangoMes`, rango semiabierto `[start, nextStart)`) ignoran fechas null (`if (!fecha) return false`). |
| Errores tipados | `ReintegroError` (clase propia, exportada de `submitDevolucion.js`) con codes: `CONDONADA`, `ELIMINADA`, `SIN_CONFIRMAR`, `SALDO_INSUFICIENTE`, `NO_ENCONTRADA`, `MONTO_INVALIDO`, `VALIDACION`. La UI de 4.3 podrá distinguirlos. |

## 11. Archivos creados en 4.1

| Archivo | Rol |
|---|---|
| `app/reintegros/helpers/modelo.js` | Funciones puras: `sentidoDelViewer`, `saldoDe`, `estadoDe`, `sumaEntregasNoEliminadas`, `assertDevueltoConsistente` (D-7), `enRangoMes` (semiabierto), `entradasDelMes`, `salidasDelMes` (I-8: `movimientoInicial` solo si `registradoPor === uid`). Sin imports de Firebase. |
| `app/reintegros/services/subscribeReintegros.js` | Suscripción R1' + D1 (batching `TANDA=10`); recibe `db`; `serverTimestamps:'estimate'`; sin D1 con lista vacía; resuscribe D1 **solo si cambia el conjunto de rids** (guard `destroyed` + `prevRidKey`). |
| `app/reintegros/hooks/useReintegros.js` | Hook: loading/error derivados de `dataUid`; **arrays vacíos si `dataUid !== uid`** (gating con `useMemo`); estados `pendientes`/`cerrados`; indicadores del mes con `sentidoDelViewer`; entradas/salidas vía `modelo.js` (I-8); stock global; D-7 en runtime (solo dev). |
| `app/agregar/components/reintegros/helpers/submitReintegro.js` | Alta transaccional (`runTransaction`, §7): doc de reintegro + evento `creacion`/`obligacion`. Valida monto entero, `sentido`, `movimientoInicial`, `uidNombre`, `contraparteNombre`, `concepto`. Recibe `db`. |
| `app/agregar/components/reintegros/helpers/submitDevolucion.js` | Devolución transaccional: entrega + update `devuelto` + evento `creacion`/`entrega`. Valida monto entero, `realizadoPorNombre`, `fechaPago`; guardas (NO_ENCONTRADA/ELIMINADA/CONDONADA/SIN_CONFIRMAR/SALDO). Exporta `ReintegroError`. Recibe `db`. |
| `tests/harness/reintegros.harness.test.mjs` | 19 tests contra emulador (§3). |
| `tests/rules/reintegros.rules.test.mjs` | +4 tests (3.41–3.44) de monto entero (§5.1); total 44. |

**Sin `page.jsx`** (decisión del usuario: 4.1 es modelo/servicios; la UI entra en 4.2+).
**Sin `registrarEvento.js`** (ajuste 8: los helpers escriben el evento directamente en su
transacción; un helper suelto se evaluará en 4.4-bis si hace falta).

## 12. Pasos posteriores NO autorizados por esta evidencia

1. ~~Commit de 4.1 en `staging`~~ — **pendiente** (este archivo se commitea con el código; el
   commit se hace tras la aprobación del usuario a 4.1).
2. **`git push origin staging`** — solo tras aprobación explícita del usuario a 4.1.
3. **`git push origin staging:main`** — requiere aprobación + flujo AGENTS.md.
4. **`firebase deploy --only firestore:rules --project finanzas-app-1c5f6`** — NO está
   autorizado; las reglas de 4.1 son las de 4.0 (ya en `staging`); el deploy de reglas
   pendiente es el de 4.0 (aprobación + ventana), no de 4.1.
5. **`firebase deploy --only firestore:indexes --project finanzas-app-1c5f6`** — NO está
   autorizado; el índice R1' (§2) queda pendiente de aprobación + ventana.
