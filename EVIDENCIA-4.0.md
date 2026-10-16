# EVIDENCIA — Subetapa 4.0 (Gate de seguridad Firestore) · AppFinanciera

> Registro de evidencia de la subetapa 4.0. Fecha: **16/10/2026**. Base de código:
> `staging` sobre `10ab576` (== `main`/`origin/staging` al iniciar). Este archivo se
> commitea junto con el resto de 4.0; **el despliegue de reglas a Producción NO está
> autorizado por este documento** (requiere aprobación aparte del usuario, §2.3 de la
> PROPUESTA).

## 1. Entorno

| Componente | Versión / estado | Nota |
|---|---|---|
| Java (JRE) | OpenJDK 17.0.20.1 LTS (Microsoft Build) | Instalado vía winget el 16/10/2026 (N-1 resuelto en máquina de dev) |
| `firebase-tools` | 14.27.0 (devDep; también global 14.15.1) | devDep por reproducibilidad (D-1) |
| `@firebase/rules-unit-testing` | **5.0.2** | Ajuste `^3` → `^5` (§6.1 de la PROPUESTA): `^3` exige peer `firebase@^10`, incompatible con `firebase@^12.12.1` del repo. Misma API (`initializeTestEnvironment`, `assertFails`, `assertSucceeds`). |
| `firebase` (app) | 12.12.1 | Sin cambios |
| Node | 20.11.1 | Runner `node:test` (D-1, aceptado 16/10/2026) |

## 2. Equivalencia repo↔consola (Bloque A)

| Artefacto | Detalle |
|---|---|
| Texto de consola (backup) | `rules-consola-backup-2026-10-16.txt` (copiado por el usuario desde Firebase Console → Firestore → Rules el 16/10/2026) |
| SHA-256 del backup | `9769979CD0EDEC03948C80D3CB2EC00191334E070CD431F2C69B092865C57792` |
| Bloque A en `firestore.rules` | 146 líneas; **diff vacío** vs backup (comparación línea a línea, 0 diferencias) |
| Hallazgo | Las reglas de consola **no incluyen `productos`** (default-deny). Documentado; fuera del alcance de estas reglas. |

## 3. Suite de reglas (`npm run test:rules`)

- **Resultado final: 25/25 PASS** (3.1–3.25), run archivado (`EVIDENCIA-4.0-hbc-rules-suite.log`).
- **Actualización post-spike 4.1 (16/10/2026):** la suite pasa a **40/40** con los tests
  3.26–3.40 (getAfter en eventos, Alt A sobre `reintegro_devoluciones`, `createdAt ==
  request.time`). Run archivado en el commit correspondiente.
- **Costo de lecturas del `list` con Alt A (estimación, NO medida):** el `get()` en la regla
  se evalúa una vez por cada doc devuelto; cada `get()` consume 1 lectura facturada. Para una
  query `in` con ≤10 IDs que devuelve M docs: M lecturas de query + M lecturas de regla = 2M
  totales. Con R-3 (≤30 entregas visibles): ≤3 queries de tanda 10 → 60–180 lecturas. Es una
  estimación basada en la documentación de Firestore; no se midió con billing real.
- Corridas intermedias (registro de iteración, no de fallo encubierto):
  - Run 1: 19/22 — 3 bugs del **test** (no de las reglas): instancias Firestore mezcladas en batches (3.8/3.15); 3.9 no contemplaba la guarda 4.6 (entregas pre-confirmación bloqueadas).
  - Run 2: 22/22 PASS (sin query `list`).
  - Run 3: 21/22 — **H-d** (ver §4): el `list` con `array-contains` era denegado (`Null value error @ L214`).
  - Run 4: 22/22 PASS con H-d corregido y query `list` real cubierta en 3.9.
  - Run 5: **25/25 PASS** con H-b/H-c resueltos y tests 3.23–3.25 añadidos (ver §5).

## 4. Hallazgos del gate (corregidos en 4.0)

| ID | Hallazgo | Corrección |
|---|---|---|
| **H-d** | La regla de lectura de `reintegros` (`allow get, list: if esParticipante(rid)`) usaba `get()` interno; el motor la rechazaba entera en queries `list` (`Null value error`), rompiendo el patrón R1' (`array-contains` sobre `participantes`) que la app usará desde 4.1 | Lectura reescrita: `allow get/list: if auth() && uid() in resource.data.participantes` (evaluable doc-por-doc por el filtro `array-contains`). Cubierto por 3.9 (query real con `array-contains`, ambas partes, no vacía). |

## 5. Hallazgos H-a/H-b/H-c — resueltos o aceptados (16/10/2026)

> Los tres hallazgos detectados en el repaso del 16/10/2026 fueron resueltos en
> reglas o aceptados explícitamente por el usuario. Ninguno queda como deuda
> abierta; el deploy a Producción sigue requiriendo aprobación aparte (§7).

| ID | Hallazgo | Resolución | Tests |
|---|---|---|---|
| **H-a** | `devuelto` editable sin entrega acompañante (acople solo en un sentido) | **ACEPTADO por el usuario como limitación documentada en v1** (16/10/2026). Racional: usuarios de confianza, único escritor legítimo son los helpers del módulo (D-6), reconciliación D-7 detecta divergencias post-hoc. El acople inverso (`ultimaEntregaId` + `existsAfter`) queda como evolución futura si aparece un cliente roto. | 3.8 cubre el acople entrega→update (sentido que las reglas garantizan). |
| **H-b** | `sentido` editable en la rama (d); `movimientoInicial` también editable; `concepto` podía vaciarse | **RESUELTO** — rama (d) reescrita como **lista blanca** (`hasOnly(['concepto','contraparteNombre','registradoPorNombre'])`). Todo lo demás congelado por defecto: `sentido`, `movimientoInicial`, monto, devuelto, constancias, confirmación, `gastoVinculadoId` y cualquier campo futuro. Cada campo exige `is string` (como el alta) y `concepto.size() > 0`. `movimientoInicial` congelado explícitamente (registro de qué movimiento se generó al alta). `concepto` congelado post-confirmación (parte del acuerdo bilateral) — decisión explícita del 16/10/2026. | 3.24: sentido→rechazado; movimientoInicial→rechazado; concepto vacío→rechazado; campo `foo` (fuera de lista)→rechazado; `contraparteNombre` no-string→rechazado; `registradoPorNombre` no-string→rechazado; editado por contraparte→rechazado; sobre condonada→rechazado; positivos de los 3 campos editables. |
| **H-c** | `monto` editable tras confirmar | **RESUELTO** — rama (c) exige `resource.data.get('confirmadaPor', null) == null`. Se usa `.get()` con default para no romper obligaciones **externas** donde el campo no existe en el documento. Decisión: congelar el monto post-confirmación (no resetear la confirmación). | 3.25: miembro confirmado→rechazado; miembro pendiente (campo en null)→aceptado; externa (campo ausente)→aceptado. |

## 6. Hallazgo H-e — pendiente abierto (spike 4.1, 16/10/2026)

| ID | Hallazgo | Estado |
|---|---|---|
| **H-e** | A puede crear una obligación con `contraparteUid` de un tercero B sin relación previa (sin que B lo sepa ni lo acepte). Las reglas no validan que exista vínculo entre A y B. | **PENDIENTE ABIERTO — a decidir antes de abrir la app al público.** Confirmado empíricamente en spike 4.1 (E11: ACEPTADO). Corrección requiere diseño de red de confianza / aceptación de contraparte (fuera de alcance de 4.1). |

**Equivalencia Bloque A vs backup de consola (re-verificada antes del push):** diff vacío
(solo difieren los dos `}` de cierre de `service`/`match` que viven al final del archivo,
después del Bloque B). SHA-256 del backup sin cambios: `9769979C…C57792`.

## 7. Verificaciones de app (criterios de done de 4.0)

| Criterio | Resultado |
|---|---|
| `npm run build` | EXIT 0 |
| `npm run lint` | 2 errores + 2 warnings — **idénticos al baseline de `10ab576`** (0 nuevos) |
| App escribe `eventos` tipo `confirmacion` | **NO** — grep `app/**/*.{js,jsx}`: 0 coincidencias de `reintegro|confirmacion|confirmadaPor` (el módulo no existe aún; se construye en 4.1+). Las reglas además solo aceptan `['creacion','edicion','eliminacion','condonacion']` (3.14). |
| `firestore.indexes.json` | Índice R1' (`participantes` array_contains + `createdAt` desc) pre-aprobado (riesgo R-2) |

## 8. Pasos posteriores NO autorizados por esta evidencia

1. ~~**Commit de 4.0 en `staging` + push a `origin/staging`**~~ — ejecutado: `ff47291` (gate inicial) y commit posterior con H-b/H-c resueltos + suite 25/25.
2. **`git push origin staging:main`** — requiere aprobación explícita posterior.
3. **`firebase deploy --only firestore:rules --project finanzas-app-1c5f6`** — requiere: (a) aprobación aparte del usuario; (b) ventana de mantenimiento (Staging y Producción comparten proyecto); (c) antes del deploy: diff del Bloque A contra la consola vigente de ese día + suite completa sobre el archivo exacto que se sube. Backup de restauración registrado en §2. H-a aceptado (§5); H-b/H-c resueltos en reglas (§5).
