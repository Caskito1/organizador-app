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

- **Resultado final: 22/22 PASS** (3.1–3.22), run archivado (`EVIDENCIA-4.0-test-rules-final-2026-10-16.log`).
- Corridas intermedias (registro de iteración, no de fallo encubierto):
  - Run 1: 19/22 — 3 bugs del **test** (no de las reglas): instancias Firestore mezcladas en batches (3.8/3.15); 3.9 no contemplaba la guarda 4.6 (entregas pre-confirmación bloqueadas).
  - Run 2: 22/22 PASS (sin query `list`).
  - Run 3: 21/22 — **H-d** (ver §4): el `list` con `array-contains` era denegado (`Null value error @ L214`).
  - Run 4: **22/22 PASS** con H-d corregido y query `list` real cubierta en 3.9.

## 4. Hallazgos del gate (corregidos en 4.0)

| ID | Hallazgo | Corrección |
|---|---|---|
| **H-d** | La regla de lectura de `reintegros` (`allow get, list: if esParticipante(rid)`) usaba `get()` interno; el motor la rechazaba entera en queries `list` (`Null value error`), rompiendo el patrón R1' (`array-contains` sobre `participantes`) que la app usará desde 4.1 | Lectura reescrita: `allow get/list: if auth() && uid() in resource.data.participantes` (evaluable doc-por-doc por el filtro `array-contains`). Cubierto por 3.9 (query real con `array-contains`, ambas partes, no vacía). |

## 5. Hallazgos pendientes — BLOQUEANTES del despliegue de reglas a Producción

> **Los tres hallazgos siguientes NO bloquean el commit de 4.0 a `staging`** (el código
> del módulo aún no existe; nadie escribe `reintegros*` en producción). **SÍ bloquean
> `firebase deploy --only firestore:rules`** hasta que se resuelvan o el usuario decida
> aceptarlos explícitamente. Detectados en el repaso del 16/10/2026.

| ID | Hallazgo | Detalle (reglas §2.2 de la PROPUESTA) | Impacto si se despliega sin resolver |
|---|---|---|---|
| **H-a** | **`devuelto` editable sin entrega acompañante** | Rama (a) del update de `reintegros`: permite subir `devuelto` con `hasOnly(['devuelto'])` sin exigir la creación de una entrega en la misma transacción. El acople 3.8 solo va en un sentido (entrega → update); el inverso (update → entrega) no está impuesto por reglas. | Un cliente malicioso/roto puede inflar `devuelto` sin entregas. Mitigación parcial: reconciliación D-7 (post-hoc). Solución posible: acople inverso con `getAfter` sobre una entrega candidate, o restringir la rama (a) a transacciones del módulo. |
| **H-b** | **`sentido` editable en la rama (d)** | Rama (d) congela monto, devuelto, constancias, confirmación y `gastoVinculadoId`, pero **no `sentido`** — el registrador puede voltear `por_cobrar` ↔ `por_devolver` post-alta. | Altera la semántica de acreedor/deudor (C1 depende de `sentido`); podría usarse para condonar indebidamente. Solución: añadir `request.resource.data.sentido == resource.data.sentido` a la rama (d). |
| **H-c** | **`monto` editable tras confirmar** | Rama (c) solo exige `devuelto == 0`; no chequea `confirmadaPor`. Tras la confirmación bilateral, el registrador puede cambiar el monto unilateralmente. | Rompe el acuerdo bilateral de 4.6 (la contraparte confirmó un monto que puede cambiar). Solución: añadir `resource.data.get('confirmadaPor', null) == null` a la rama (c), o exigir re-confirmación. |

**Estado:** pendientes de decisión/resolución del usuario **antes del despliegue a
Producción**. Pueden resolverse como corrección de reglas en esta misma 4.0 (nueva
corrida de suite) o escalarse a 4.6 si el usuario lo decide.

## 6. Verificaciones de app (criterios de done de 4.0)

| Criterio | Resultado |
|---|---|
| `npm run build` | EXIT 0 |
| `npm run lint` | 2 errores + 2 warnings — **idénticos al baseline de `10ab576`** (0 nuevos) |
| App escribe `eventos` tipo `confirmacion` | **NO** — grep `app/**/*.{js,jsx}`: 0 coincidencias de `reintegro|confirmacion|confirmadaPor` (el módulo no existe aún; se construye en 4.1+). Las reglas además solo aceptan `['creacion','edicion','eliminacion','condonacion']` (3.14). |
| `firestore.indexes.json` | Índice R1' (`participantes` array_contains + `createdAt` desc) pre-aprobado (riesgo R-2) |

## 7. Pasos posteriores NO autorizados por esta evidencia

1. **Commit de 4.0 en `staging` + push a `origin/staging`** — autorizado por el usuario (16/10/2026), pendiente de ejecución al momento de escribir este archivo.
2. **`git push origin staging:main`** — requiere aprobación explícita posterior.
3. **`firebase deploy --only firestore:rules --project finanzas-app-1c5f6`** — requiere: (a) resolución o aceptación explícita de **H-a/H-b/H-c**; (b) aprobación aparte del usuario; (c) ventana de mantenimiento (Staging y Producción comparten proyecto). Backup de restauración registrado en §2.
