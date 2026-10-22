# EVIDENCIA-4.3 — Reintegros: pago (4.3a), edición de monto (4.3b) y dinero/ítem + espejo (4.3c)

**Estado:** 4.3a cerrada (commit `7d41d39`). **4.3b CERRADA 21/10/2026** (commits `2e1ba5f` código / `687d65b` esta evidencia, en `staging`, sin push). **4.3c CERRADA 22/10/2026** (commits `7ae1021` código / este commit docs, en `staging`, sin push): ajustes de QA (ticks desmarcados en ambos sentidos, fix de layout) + ajuste final de estilo del usuario validado en pantalla; gates repetidos en verde el 22/10.
Repo: `AppFinanciera/` · rama `staging` · hoy 22/10/2026.

## 1. Entorno de prueba local (verificado 21/10/2026)

- Emuladores: `npx firebase emulators:start --only firestore,auth --project finanzas-app-1c5f6` → Firestore 8080 · Auth 9099 · UI `http://127.0.0.1:4000`.
- Dev: `npm run dev` → `http://localhost:3000` (flag `NEXT_PUBLIC_USE_EMULATOR=true` en `.env.development.local`).
- Siembra: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run seed:emulator`.
  - Credenciales: `registrador@demo.local / Prueba-Registrador-2026` y `contraparte@demo.local / Prueba-Contraparte-2026`.
  - El emulador NO persiste: tras reinicio, re-siembrar (uids nuevos); los datos de prueba se pierden.
  - La siembra no crea obligaciones: se crean desde «Agregar» / `ReintegroModal`.

## 2. Gates fase ② (21/10/2026) — todos en verde

| Gate | Resultado |
|---|---|
| `npm run lint` | baseline exacta: 4 preexistentes (2 err `react-hooks/set-state-in-effect` en `useIngresos.js:39` y `GroupContext.jsx:17`, 2 warn `HomeHeader.jsx:28` y `page.js:10`), **0 nuevos** |
| `npm run build` | EXIT 0 — 10 páginas, `/reintegros` |
| `npm run harness:reintegros` | **30/30** (fail 0) — 20 previos + H15–H21 |
| `npm run test:rules` | **44/44** (fail 0) — sin cambios en `firestore.rules` |

Procedimiento: puertos 8080/9099/3000/4000 liberados antes de los gates y restaurados después (emuladores + siembra + dev `/login` 200).

## 3. Archivos de la fase ②

- **Nuevos:** `app/agregar/components/reintegros/helpers/editarEntrega.js` (edición de pago — ambas partes, rama (ii)) · `editarObligacion.js` (monto de obligación — solo registrador con `devuelto == 0`, rama (c)). Autocontenidos: reciben `db` como parámetro; no importan `modelo.js`; reutilizan `ReintegroError` de `submitDevolucion.js` **sin modificarlo**.
- **Modificado:** `tests/harness/reintegros.harness.test.mjs` (+H15–H21, helpers `baseEntrega`/`readEdicionEventos`).
- Eventos `edicion`: `{registradoPor, tipo, entidad, montoAnterior, montoNuevo, createdAt: serverTimestamp()}` (+ `entregaId` si `entidad == "entrega"`). El create de eventos no tiene `hasOnly` en reglas: los campos extra se escriben sin tocar `firestore.rules` (verificado 21/10/2026).

### 3.1 Nota obligatoria — LIQUIDADA: única barrera de cliente

**Las reglas NO bloquean editar una entrega de una obligación LIQUIDADA (saldo 0):** la rama (ii) solo exige participante, monto entero/distinto y el acople de `devuelto` vía `getAfter`; de hecho, bajar un pago sobre una obligación saldada la reabriría legítimamente. La decisión de producto (21/10/2026) es **no editar en Saldados**, por lo que la única barrera para el caso liquidada es la **guarda de cliente** `LIQUIDADA` en `editarEntrega.js`, verificada por **H17** en el harness (sobre condonada/eliminada sí bloquean también las reglas). Si algún día se quisiera permitir esa edición, bastaría quitar la guarda: las reglas la dejan pasar.

### 3.2 Nota — chips de edición (decisión de producto)

Los chips «Editado: $300 → $200 · 21/10» se muestran **solo en la pestaña Activos**. Al liquidarse una obligación migra a Saldados y **el chip deja de verse** (no hay suscripción de eventos sobre cerradas). Alternativa futura: una lectura puntual (on-demand, no suscripta) al expandir una cerrada, si se quisiera conservar la trazabilidad visible en Saldados.

## 4. Fase ③ — UI de edición (21/10/2026)

- **Nuevos:** `app/reintegros/hooks/useEdiciones.js` · `app/reintegros/components/EditarReintegroModal.jsx`.
- **Editados:** `app/reintegros/page.jsx` (estado `edicion`, `idsActivas`, monta modal) · `sections/PendientesSection.jsx` (passthrough) · `components/FilaReintegro.jsx` («Editar» por pago, «Editar monto» solo registrador, chips).
- Criterios implementados (todos exigidos por el usuario):
  - `useEdiciones` **no rompe la página** si una suscripción falla (permisos/red): `onSnapshot(onError)` solo avisa por consola; esa obligación queda sin chips y el resto sigue vivo.
  - Desuscripción correcta al cambiar de pestaña (`idsActivas` → `[]` en Saldados ⇒ efecto limpia todas las listeners) y cuando una obligación deja de estar activa (sale de `pendientes` ⇒ sale de `ids`).
  - Mapeo filtrando por `entidad` (`obligacion` vs `entrega`), conservando el **último** evento de cada una (por `createdAt` de servidor).
  - Chips **solo en Activos** (CerradosSection no recibe `ediciones` ni callbacks).
  - Vigentes: `MODAL_SHEET_CLASSES`, monto entero tope 12 dígitos, timeout 15 s sin reintento, anti-doble-toque (`enviandoRef`), R-6 «No se guardó nada: sin conexión…».

### 4.1 Hallazgo `#problema` — bug latente de 4.1 destapado en la validación (21/10/2026)

- **Síntoma reportado:** al editar el monto GENERAL de una obligación, la escritura sí llegaba a Firestore (al re-editar el helper respondía `MONTO_SIN_CAMBIOS`), pero la UX **no lo reflejaba** (fila, acordeón ni balance/header). La edición de pagos parciales sí se reflejaba.
- **Causa:** en `subscribeReintegros.js`, el guard «solo resuscribir si cambió el conjunto de rids» hacía `return` **sin llamar a `emit()`**. La edición de monto escribe SOLO `reintegros` (R1' re-emitía pero no publicaba) y no toca `reintegro_devoluciones` (D1 no emitía) ⇒ la UI nunca se enteraba. El pago sí funcionaba porque tocaba D1, que al emitir «arrastraba» el snapshot ya actualizado de obligaciones. Bug latente desde 4.1 (afectaba a cualquier cambio de campos de obligaciones, p. ej. concepto).
- **Fix:** si el conjunto de rids no cambió pero el snapshot trae `docChanges()` reales, se emite igual (`emit()`); una re-emisión redundante (0 cambios) no genera emisión extra.
- **Regresión:** **HS5** en el harness (31 tests): editar el monto general con la suscripción viva debe re-emitir con el monto nuevo; sin el fix queda en timeout.

### 4.2 Ajuste UX pedido (21/10/2026)

- El botón «Editar monto» (general) era de ancho completo al final de la fila: ahora es un botón **chico** (mismo estilo del «Editar» de cada pago) en la columna derecha, debajo del monto y su estado («$1500 / Parcial / [Editar monto]»).

### 4.3 Gates fase ③ tras el fix (21/10/2026) — todos en verde

| Gate | Resultado |
|---|---|
| `npm run lint` | baseline 4 preexistentes, **0 nuevos** |
| `npm run build` | EXIT 0 — 10 páginas |
| `npm run harness:reintegros` | **31/31** (20 previos + H15–H21 + HS5) |
| `npm run test:rules` | **44/44** — `firestore.rules` intacto |

## 5. Subetapa 4.3c — tick dinero/ítem en ambos sentidos + espejo + chip (21/10/2026)

Decisiones de producto (todas del usuario, 21/10/2026): quien presta o paga **siempre tiene una salida**; el tick solo decide si **el otro** tiene una entrada. El tick nuevo de `/agregar` para «presté» (por_cobrar) se llama **«La otra persona recibió dinero (efectivo o transferencia)»**. **Actualización al validar (21/10/2026): AMBOS ticks vienen DESMARCADOS por defecto** (el de por_cobrar estaba aprobado con default marcado; el usuario lo cambió al hacer la validación visual) — sin marca se guarda `movimientoInicialTipo: "item"`, por lo que **el espejo de la contraparte queda opt-in**: no bookkea la entrada hasta que se marque. Mi salida automática en por_cobrar no cambia en ningún caso. El tick existente de «me prestaron» (por_devolver, *«Me entró dinero…»*, desmarcado) no cambió. Los pagos siguen igual. **Supuesto documentado:** estos movimientos se ingresan solo desde esta app.

### 5.1 Campo nuevo: `movimientoInicialTipo`

- **`movimientoInicialTipo: "dinero" | "item"`**, persistido **solo en por_cobrar** (en por_devolver el dinero/ítem ya vive en `movimientoInicial`: `"entrada"` = dinero, `"ninguno"` = ítem; el campo no se envía — esquema limpio).
- **Valor distinto de `dinero`/`item` (o ausente) se trata como AUSENTE**: para el **espejo** se asume **dinero** (retrocompatibilidad con obligaciones viejas); para el **chip** no se muestra. Caso de harness: **H28**. El **default de la UI** (21/10/2026) es el tick **desmarcado** → `item` en docs nuevos por_cobrar; el espejo se activa solo al marcar.
- Validación en `submitReintegro`: si viene, debe ser `dinero`/`item` y SOLO en por_cobrar (`VALIDACION` si no) — H31.

### 5.2 Tabla del ESPEJO (lado de la contraparte MIEMBRO, derivado al leer en `modelo.js`)

| Doc (sentido de quien registró) | Registrador ve (mes de la alta) | Contraparte **miembro** ve (mes de la alta) |
|---|---|---|
| por_cobrar + dinero | Salida (igual que hoy) | **Entrada** |
| por_cobrar + ítem | Salida | Nada |
| por_cobrar vieja **sin campo** | Salida | **Entrada** (se asume dinero) |
| por_devolver (registra quien recibe) | Entrada si marcó «Me entró dinero», si no $0 | **Salida SIEMPRE** (aunque sea ítem) |

- **Externas: sin espejo** (el uid externo no está en `participantes`, nunca matchea el filtro). No participantes: sin espejo (H26).
- La contraparte **nunca bookkea una salida propia del doc ajeno** (garantía de no duplicar de I-8 preservada — H13 reescrito: bookkea la entrada espejo, jamás salida propia).
- El espejo usa el **monto vigente**: si el registrador edita el monto (4.3b), ambos libros ven el monto nuevo (H29).

### 5.3 Efecto RETROACTIVO (a considerar por el usuario)

Al aplicarse el espejo sobre obligaciones **existentes**, los meses ya pasados de la contraparte **cambian**: una obligación de septiembre creada por el otro hoy suma entrada/salida en septiembre de SU libro (antes `$0`). El historial no se reescribe en Firestore (no hay escrituras: todo es derivado al leer), pero el agregado mensual mostrado sí incluye esos movimientos retroactivamente.

### 5.4 Chip «Dinero»/«Ítem»

- Chip **discreto** en `FilaReintegro`, derivado con `tipoDineroDe()` del documento (sin suscripciones): se muestra en **Activos y en Saldados**.
- por_devolver → desde `movimientoInicial` (entrada → Dinero, ninguno → Ítem); por_cobrar → desde `movimientoInicialTipo`; **si falta el campo (obligación vieja): sin chip**.

### 5.5 Verificación única que frenaba — reglas de create: ✅ SIN CAMBIOS

`firestore.rules` (create de `reintegros`, líneas 225-254) **no tiene lista cerrada** (`hasOnly` solo existe en las ramas de update: (a)/(d)). Acepta el campo nuevo tal cual → **no se tocan reglas ni índices** (criterio g del usuario), test:rules **44/44 sin cambios** y **sin pegado manual a producción**. Nota: la rama de edición de monto (d) usa `affectedKeys().hasOnly(['monto'])`, por lo que `movimientoInicialTipo` queda **inmutable de facto** (solo create) — coherente con que no se edita después.

### 5.6 Archivos tocados (7)

1. `app/reintegros/helpers/modelo.js` — `tipoDineroDe()`, `esDineroInicial()`/`esContraparteMiembro()` (internos) y el espejo en `entradasDelMes`/`salidasDelMes`.
2. `app/agregar/components/reintegros/helpers/submitReintegro.js` — valida y persiste el campo (solo por_cobrar).
3. `app/agregar/components/reintegros/hooks/useReintegroModal.js` — estado `otroRecibioDinero` (default **false** — ambos ticks desmarcados), `movimientoInicialTipo` derivado.
4. `app/agregar/components/reintegros/ReintegroModal.jsx` — tick por_cobrar («La otra persona recibió dinero…», **desmarcado por defecto**) + envío del campo; ambos ticks con checkbox de tamaño nativo (ver nota de estilo ↓).
5. `app/reintegros/components/FilaReintegro.jsx` — `ChipTipoDinero`.
6. `tests/harness/reintegros.harness.test.mjs` — H13 reescrito + H22–H31.
7. `EVIDENCIA-4.3.md` — este documento.

**Nota de estilo (21–22/10/2026):** `globals.css:66-77` aplica `width:100%; padding:12px 16px; border-radius:14px` a **todo** `input`, por lo que los dos checkboxes ocupaban ~50% del ancho del bloque. Fix en los dos ticks: `className="mt-[3px] !w-4 min-w-4 shrink-0 border-0 bg-transparent p-0"` (anula el ancho/padding heredado, casilla de 16px fija) + labels con `text-[12px]` — **ajuste final de estilo aplicado por el usuario (22/10/2026), validado en pantalla**. Decisión registrada: fix local en JSX (no se tocó `globals.css`, para no afectar a los demás inputs de la app).

### 5.7 Harness (H13 reescrito + H22–H31)

- **H13** reescrito: preserva la garantía de no-duplicar (contraparte: entradas espejo, **cero** salidas propias del doc ajeno).
- **H22** por_cobrar dinero → espejo entrada · **H23** ítem → nada · **H24** por_devolver con tick → contraparte salida · **H25** por_devolver sin tick (ítem) → contraparte salida **siempre** · **H26** externa/no participante → sin espejo · **H27** vieja sin campo → espejo dinero + sin chip · **H28** valor inválido → espejo dinero + sin chip · **H29** espejo con monto editado vía `editarObligacion` · **H30** `tipoDineroDe` (todos los casos del chip) · **H31** alta con/sin el campo y rechazos (`VALIDACION`).

### 5.8 Gates 4.3c (21/10/2026; repetidos 22/10/2026 tras los ajustes de estilo) — todos en verde

| Gate | Resultado |
|---|---|
| `npm run lint` | baseline 4 preexistentes, **0 nuevos** |
| `npm run build` | EXIT 0 — 10 páginas |
| `npm run harness:reintegros` | **41/41** (fail 0) — 31 previos + H22–H31 |
| `npm run test:rules` | **44/44** — `firestore.rules` e índices intactos |

Puertos 8080/9099/3000/4000 liberados antes de los gates y restaurados después (emuladores + siembra + dev `/login` 200).

### 5.9 Fixture de emulador (post-gates) + «Dinero del mes» esperado

Fixture creado por REST con `Bearer owner` (backdate de `createdAt`; el propio alta de la app no permite antigüedad: `createdAt == request.time`):

| Doc | Quién registra | Sentido | Monto | Campo |
|---|---|---|---|---|
| `FIX43C-o1` (15/09) | Ana → Bruno | por_cobrar | $800 | `movimientoInicialTipo: "dinero"`, `devuelto: 300` |
| `FIX43C-o2` (18/09) | Ana → Bruno | por_cobrar | $1500 | `movimientoInicialTipo: "item"` |
| `FIX43C-o3` (20/09) | Bruno → Ana | por_devolver | $600 | `movimientoInicial: "entrada"` (tick marcado) |
| `FIX43C-o4` (22/09) | Bruno → Ana | por_devolver | $400 | `movimientoInicial: "ninguno"` (sin tick) |
| `FIX43C-pago1` (05/10) | Bruno paga sobre O1 | — | $300 | — |

**Números esperados** (calculados ejecutando `modelo.js` real sobre los docs del fixture):

| Mes | Ana | Bruno |
|---|---|---|
| **Septiembre** | Entradas $0 · **Salidas $3.300** (800+1500 propias + 600+400 espejo de por_devolver) | **Entradas $1.400** (800 espejo de O1 dinero + 600 propia con tick) · Salidas $0 |
| **Octubre** | **Entradas $300** (pago recibido) · Salidas $0 | Entradas $0 · **Salidas $300** (pago realizado) |

## 6. Cierre y pendientes

- ✅ Diff de 4.3c pasado al usuario; **OK y validación visual** del checklist (21/10) y del ajuste final de estilo de los ticks (22/10, "ya quedó correcto").
- ✅ Commits separados en `staging`: `7ae1021` (código) + este commit (docs); **sin push**.
- Fixture recreado el 22/10/2026 tras los gates (los reinicios de los emuladores regeneran los uids del seed: Registrador `mEdBhiG5…`, Contraparte `QTxe0x4Z…`; scripts en `$env:TEMP\opencode\fixture-43c.mjs` y `verify-43c.mjs`) — números re-verificados idénticos a §5.9.

### 6.1 Advertencia de Preview y orden de cierre (decisión del usuario, 22/10/2026)

- **Staging y Producción comparten el mismo proyecto Firebase** (`finanzas-app-1c5f6`): un deployment de **Preview** de `staging`, si alguien lo usa, **sí escribe en el Firestore de producción**, sometido a las **reglas actualmente desplegadas en Firebase** (las de producción). Por eso: **no se usa el Preview de este repo para Reintegros hasta el cierre de la Etapa 4**.
- **Orden de cierre (cuando todo el bloque Etapa 4 esté junto):** (1) `npm run test:rules` final → (2) **deploy de reglas** a Firebase → (3) promover `staging` → `main` con **aprobación explícita** → (4) verificación en Producción.
- **Antes del paso (2):** revisar que las reglas nuevas **no rompan nada de la app actual en `main`**. Dato verificado 22/10: `main` **no tiene** `firestore.rules`/`firestore.indexes.json`/`firebase.json` versionados (se versionaron por primera vez en la Etapa 4, desde `staging`) — además de `test:rules`, la comparación debe incluir las reglas **hoy desplegadas** en el proyecto (`REQUIERE_VALIDACIÓN_FIRESTORE`, lectura a cargo del usuario).
- `main` intacto (=`origin/main` en `10ab576`); push de `staging` permitido como respaldo.
