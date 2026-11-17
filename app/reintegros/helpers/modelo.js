// reintegros/helpers/modelo.js
// Funciones puras del modelo de Reintegros. Sin imports de Firebase:
// importables por el harness (Node) y por la app (Next.js).

// Sentido de la obligación desde la perspectiva del visualizador.
// El registrador ve su propio sentido; la contraparte ve el inverso.
export function sentidoDelViewer(r, uid) {
  if (r.registradoPor === uid) return r.sentido;
  return r.sentido === "por_cobrar" ? "por_devolver" : "por_cobrar";
}

// Saldo abierto de la obligación.
export function saldoDe(r) {
  return Number(r.monto || 0) - Number(r.devuelto || 0);
}

// Estado 100% derivado (I-3): ninguna escritura almacena `estado`.
// Condonada y eliminada se detectan por la presencia de su constancia.
export function estadoDe(r) {
  if ("eliminacion" in r) return "eliminado";
  if ("condonacion" in r) return "condonado";
  const saldo = saldoDe(r);
  if (saldo <= 0) return "liquidado";
  if (Number(r.devuelto || 0) > 0) return "parcial";
  return "pendiente";
}

// Σ montos de entregas no eliminadas.
export function sumaEntregasNoEliminadas(entregas) {
  return entregas
    .filter((e) => !("eliminacion" in e))
    .reduce((a, e) => a + Number(e.monto || 0), 0);
}

// D-7: devuelto debe coincidir con Σ entregas no eliminadas.
export function assertDevueltoConsistente(obligacion, entregas) {
  return (
    Number(obligacion.devuelto || 0) === sumaEntregasNoEliminadas(entregas)
  );
}

// Fecha efectiva de la obligación (5.0-fecha): `fecha` manda; `createdAt` es
// el fallback de los documentos cargados antes de esta subetapa (F-3, sin
// migración ni backfill). Devuelve Date (o null) para que enRangoMes y la UI
// usen la MISMA fuente de atribución: no usar `createdAt` directo en ningún
// cálculo de período ni en la fila.
export function fechaEfectivaDe(r) {
  const f = r?.fecha ?? r?.createdAt ?? null;
  if (!f) return null;
  return f?.toDate?.() ?? new Date(f);
}

// Rango de mes SEMIABIERTO: [start, nextStart). Cubre el instante exacto
// del primer día del mes siguiente (el closed-range perdía la medianoche
// exacta del día 1 siguiente por el redondeo de milisegundos).
export function enRangoMes(fecha, start, nextStart) {
  if (!fecha) return false;
  const d = fecha?.toDate?.() ?? new Date(fecha);
  return d >= start && d < nextStart;
}

// ── 4.3c — dinero/ítem + espejo ───────────────────────────────────────────

// Chip «Dinero»/«Ítem» (derivado del documento, sin suscripciones):
//   por_devolver → se lee de movimientoInicial (entrada=dinero, ninguno=item);
//   por_cobrar  → de movimientoInicialTipo; ausente o valor desconocido →
//   null (las obligaciones viejas no muestran chip).
export function tipoDineroDe(r) {
  if (r.sentido === "por_devolver") {
    return r.movimientoInicial === "entrada" ? "dinero" : "item";
  }
  const t = r.movimientoInicialTipo;
  return t === "dinero" || t === "item" ? t : null;
}

// ¿La obligación por_cobrar representa dinero entregado (no un ítem)?
// Retrocompat: ausente o valor desconocido → dinero (decisión 4.3c: los
// docs viejos sin el campo se interpretan como dinero para el espejo).
function esDineroInicial(r) {
  return r.movimientoInicialTipo !== "item";
}

// ── Regla de dominio del espejo (30/10/2026) — NO SIMETRIZAR ──────────────
// En Reintegros SOLO circula dinero (prestar objetos no existe en el
// modelo): el eje dinero/ítem dice QUÉ se entregó, no si hubo caja.
//   · SALIDA: siempre salió dinero (efectivo prestado o pago adelantado)
//     ⇒ salidasDelMes / espejoSalida NO filtran por tipo.
//   · ENTRADA: solo si el dinero entró a la cuenta; si la deuda nace
//     porque otro pagó o compró algo por vos, no hay entrada (la deuda
//     sí existe) ⇒ espejoEntrada exige dinero (esDineroInicial).
// La asimetría es del DOMINIO: entrada espejo solo dinero · salida espejo
// sin filtro. No son simétricos y no deben simetrizarse (4.5-bis cancelada
// el 30/10/2026 sin cambio de código; ver context/dominio.md §5.1 ítem 5).

// Espejo: SOLO la contraparte MIEMBRO bookkea el movimiento de la alta de
// una obligación registrada por el otro (decisión 4.3c). Las externas no:
// su uid no está en participantes, así que nunca matchean este filtro.
function esContraparteMiembro(r, uid) {
  return (
    r.registradoPor !== uid && (r.participantes || []).includes(uid)
  );
}

// Entradas del mes (§6.2/I-8 + espejo 4.3c): devoluciones recibidas del
// mes + Σ monto de obligaciones CREADAS POR EL USUARIO (registradoPor ===
// uid) con movimientoInicial == "entrada" en el mes de su FECHA EFECTIVA
// (5.0-fecha: `fecha` con fallback a `createdAt`) + espejo: obligación ajena
// por_cobrar con dinero → mi ENTRADA en ese mismo mes.
// ENTRADA ≠ SALIDA: este espejo exige dinero (regla de dominio de arriba).
// Un ítem no genera entrada aunque la deuda exista. NO simetrizar con
// espejoSalida.
export function entradasDelMes({
  obligaciones,
  entregas,
  uid,
  start,
  nextStart,
}) {
  const activas = obligaciones.filter((r) => !("eliminacion" in r));
  const entregasActivas = entregas.filter((e) => !("eliminacion" in e));
  const recibidas = entregasActivas
    .filter((d) => {
      const obl = activas.find((r) => r.id === d.reintegroId);
      if (!obl) return false;
      return (
        sentidoDelViewer(obl, uid) === "por_cobrar" &&
        enRangoMes(d.fechaPago, start, nextStart)
      );
    })
    .reduce((a, d) => a + Number(d.monto || 0), 0);
  const movimientos = activas
    .filter(
      (r) =>
        r.registradoPor === uid &&
        r.movimientoInicial === "entrada" &&
        enRangoMes(fechaEfectivaDe(r), start, nextStart),
    )
    .reduce((a, r) => a + Number(r.monto || 0), 0);
  const espejoEntrada = activas
    .filter(
      (r) =>
        esContraparteMiembro(r, uid) &&
        r.sentido === "por_cobrar" &&
        esDineroInicial(r) &&
        enRangoMes(fechaEfectivaDe(r), start, nextStart),
    )
    .reduce((a, r) => a + Number(r.monto || 0), 0);
  return recibidas + movimientos + espejoEntrada;
}

// Salidas del mes (§6.2/I-8 + espejo 4.3c): devoluciones realizadas del
// mes + Σ monto de obligaciones CREADAS POR EL USUARIO con
// movimientoInicial == "salida" en el mes de su FECHA EFECTIVA (5.0-fecha:
// `fecha` con fallback a `createdAt`) + espejo: obligación ajena
// por_devolver (la registró quien recibe) → la contraparte miembro ve su
// SALIDA en ese mismo mes, sea efectivo prestado o una compra
// adelantada: en ambos casos salió dinero de la cuenta.
// SALIDA ≠ ENTRADA: aquí NO se filtra por tipo a propósito; es la
// asimetría real del dominio (regla de arriba). NO simetrizar con
// espejoEntrada — 4.5-bis se canceló el 30/10/2026.
export function salidasDelMes({
  obligaciones,
  entregas,
  uid,
  start,
  nextStart,
}) {
  const activas = obligaciones.filter((r) => !("eliminacion" in r));
  const entregasActivas = entregas.filter((e) => !("eliminacion" in e));
  // 4.3-bis: solo suman pagos cuya obligación siga activa — espejo de
  // recibidas en entradasDelMes. Obligación eliminada ⇒ la entrega
  // conservada (I-4) deja de contar en ambos libros; condonadas y
  // liquidadas (sin constancia de eliminación) siguen contando.
  const activasIds = new Set(activas.map((r) => r.id));
  const realizadas = entregasActivas
    .filter(
      (d) =>
        activasIds.has(d.reintegroId) &&
        d.realizadoPorUid === uid &&
        enRangoMes(d.fechaPago, start, nextStart),
    )
    .reduce((a, d) => a + Number(d.monto || 0), 0);
  const movimientos = activas
    .filter(
      (r) =>
        r.registradoPor === uid &&
        r.movimientoInicial === "salida" &&
        enRangoMes(fechaEfectivaDe(r), start, nextStart),
    )
    .reduce((a, r) => a + Number(r.monto || 0), 0);
  const espejoSalida = activas
    .filter(
      (r) =>
        esContraparteMiembro(r, uid) &&
        r.sentido === "por_devolver" &&
        enRangoMes(fechaEfectivaDe(r), start, nextStart),
    )
    .reduce((a, r) => a + Number(r.monto || 0), 0);
  return realizadas + movimientos + espejoSalida;
}
