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

// Entradas del mes (§6.2/I-8): devoluciones recibidas del mes + Σ monto de
// obligaciones CREADAS POR EL USUARIO (registradoPor === uid) con
// movimientoInicial == "entrada" en el mes. I-8: la contraparte NO cuenta el
// movimientoInicial ajeno — solo el registrador lo registró en SU libro.
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
  return recibidas + movimientos;
}

// Salidas del mes (§6.2/I-8): devoluciones realizadas del mes + Σ monto de
// obligaciones CREADAS POR EL USUARIO (registradoPor === uid) con
// movimientoInicial == "salida" en el mes. Mismo criterio I-8.
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
  return realizadas + movimientos;
}
