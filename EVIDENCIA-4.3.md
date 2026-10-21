# EVIDENCIA-4.3 — Reintegros: pago con método/fecha/hora (4.3a) y edición de monto (4.3b)

**Estado:** 4.3a cerrada (commit `7d41d39` en `staging`, sin push). **4.3b: fases ② (helpers+harness) y ③ (UI) implementadas 21/10/2026 con gates en verde; pendiente validación manual del usuario y commit.**
Repo: `AppFinanciera/` · rama `staging` · hoy 21/10/2026.

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

## 5. Pendientes

- Validación manual del usuario en local (checklist de fase ③) y aprobación para commit de 4.3b.
- ⚠️ Los emuladores se reiniciaron para los gates: **los fixtures de prueba se perdieron** (el emulador no persiste) — re-crear las 3 obligaciones (sin pagos / parcial / liquidada) antes de validar.
- Sin commitear hasta OK del usuario; sin push; `main` intacto.
