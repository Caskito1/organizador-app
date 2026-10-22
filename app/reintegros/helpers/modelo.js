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
// uid) con movimientoInicial == "entrada" en el mes + espejo: obligación
// ajena por_cobrar con dinero → mi ENTRADA en el mes de la alta.
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
        enRangoMes(r.createdAt, start, nextStart),
    )
    .reduce((a, r) => a + Number(r.monto || 0), 0);
  const espejoEntrada = activas
    .filter(
      (r) =>
        esContraparteMiembro(r, uid) &&
        r.sentido === "por_cobrar" &&
        esDineroInicial(r) &&
        enRangoMes(r.createdAt, start, nextStart),
    )
    .reduce((a, r) => a + Number(r.monto || 0), 0);
  return recibidas + movimientos + espejoEntrada;
}

// Salidas del mes (§6.2/I-8 + espejo 4.3c): devoluciones realizadas del
// mes + Σ monto de obligaciones CREADAS POR EL USUARIO con
// movimientoInicial == "salida" en el mes + espejo: obligación ajena
// por_devolver (la registró quien recibe) → la contraparte miembro ve
// SIEMPRE su SALIDA en el mes de la alta, incluso si es un ítem.
export function salidasDelMes({
  obligaciones,
  entregas,
  uid,
  start,
  nextStart,
}) {
  const activas = obligaciones.filter((r) => !("eliminacion" in r));
  const entregasActivas = entregas.filter((e) => !("eliminacion" in e));
  const realizadas = entregasActivas
    .filter(
      (d) =>
        d.realizadoPorUid === uid &&
        enRangoMes(d.fechaPago, start, nextStart),
    )
    .reduce((a, d) => a + Number(d.monto || 0), 0);
  const movimientos = activas
    .filter(
      (r) =>
        r.registradoPor === uid &&
        r.movimientoInicial === "salida" &&
        enRangoMes(r.createdAt, start, nextStart),
    )
    .reduce((a, r) => a + Number(r.monto || 0), 0);
  const espejoSalida = activas
    .filter(
      (r) =>
        esContraparteMiembro(r, uid) &&
        r.sentido === "por_devolver" &&
        enRangoMes(r.createdAt, start, nextStart),
    )
    .reduce((a, r) => a + Number(r.monto || 0), 0);
  return realizadas + movimientos + espejoSalida;
}
