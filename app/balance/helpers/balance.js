// balance/helpers/balance.js
// NÚCLEO PURO del balance consolidado (5.1). Sin SDK de Firebase y sin alias
// @/…: lo importan la app (Next), los unitarios (node --test) y el harness.
//
// Contrato y semántica: PROPUESTA-ETAPA-5.md §5.1.5 / §5.1.6. Reglas duras:
//  - `inversiones` es un INPUT (neto con signo), no una lectura (B-12).
//  - `resultado` = ingresos.uyu − egresos.total; el USD nunca entra.
//  - `movimientoEsperado` = resultado + reintegros.neto + inversiones (B-13).
//  - las condonaciones informan y salen del stock: NO mueven el movimiento.
//  - caja al inicio / al cierre y contraste son de 5.2 (B-14), no de acá.

import { aDate, fechaEfectiva } from "../../gastos/helpers/dateHelpers.js";
import {
  esPagado,
  parteDelUsuarioDeFijo,
} from "../../gastos/helpers/fijosCriterio.js";
import {
  UYU,
  USD,
  sumarPorMoneda,
} from "../../ingresos/helpers/ingresosMoneda.js";
import {
  enRangoMes,
  entradasDelMes,
  estadoDe,
  fechaEfectivaDe,
  saldoDe,
  salidasDelMes,
  sentidoDelViewer,
} from "../../reintegros/helpers/modelo.js";

const MES_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

// Error tipado del módulo (validación o lectura). El adaptador agrega
// `coleccion`/`causa` cuando falla una consulta.
export class BalanceError extends Error {
  constructor(codigo, mensaje, { coleccion = null, causa = null } = {}) {
    super(mensaje);

    this.name = "BalanceError";
    this.codigo = codigo;
    this.coleccion = coleccion;
    this.causa = causa;
  }
}

// 'YYYY-MM' → rango local SEMIABIERTO [desde, hasta) (B-5).
export function rangoDelMes(mes) {
  const match = typeof mes === "string" ? MES_RE.exec(mes) : null;

  if (!match) {
    throw new BalanceError("MES_INVALIDO", `Mes inválido: ${String(mes)}.`);
  }

  const anio = Number(match[1]);
  const numeroMes = Number(match[2]);

  return {
    desde: new Date(anio, numeroMes - 1, 1),
    hasta: new Date(anio, numeroMes, 1),
  };
}

// 'YYYY-MM' local de una fecha.
function mesDe(fecha) {
  const anio = fecha.getFullYear();
  const numeroMes = String(fecha.getMonth() + 1).padStart(2, "0");

  return `${anio}-${numeroMes}`;
}

// Corte del stock (B-3): mes cerrado → último instante del mes; mes en curso
// o futuro → ahora (no hay cierre futuro).
function corteDe(mes, ahora) {
  const { hasta } = rangoDelMes(mes);

  if (mes < mesDe(ahora)) return new Date(hasta.getTime() - 1);

  return ahora;
}

// Inversiones: neto con signo (rescates + / aportes −), default 0 (B-12).
function normalizarInversiones(valor) {
  if (valor === undefined || valor === null) return 0;

  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    throw new BalanceError(
      "INVERSIONES_INVALIDAS",
      `Inversiones inválidas: ${String(valor)}.`,
    );
  }

  return numero;
}

// Σ devuelto AL CORTE: entregas no eliminadas con fechaPago efectiva <= corte.
// NO se usa `r.devuelto` (acumulado de HOY). Sin fechaPago ni createdAt, la
// entrega cuenta en todos los cortes (las reglas exigen fechaPago en el alta).
function devueltoAlCorte(obligacion, entregas, corte) {
  let total = 0;

  for (const entrega of entregas) {
    if (entrega.reintegroId !== obligacion.id) continue;

    const fecha = aDate(entrega.fechaPago) ?? aDate(entrega.createdAt);

    if (fecha && fecha > corte) continue;

    total += Number(entrega.monto || 0);
  }

  return total;
}

// Vista de la obligación al corte para reusar `saldoDe`/`estadoDe` sin
// reimplementarlos (B-3): `devuelto` reconstruido y, si la condonación es
// POSTERIOR al corte, se quita la constancia (al corte seguía pendiente). Sin
// `createdAt` no se puede fechar: se considera aplicada (no se resucita una
// deuda perdonada).
function vistaAlCorte(obligacion, entregas, corte) {
  const vista = {
    ...obligacion,
    devuelto: devueltoAlCorte(obligacion, entregas, corte),
  };

  if (obligacion.condonacion) {
    const cuando = aDate(obligacion.condonacion.createdAt);

    if (cuando && cuando > corte) delete vista.condonacion;
  }

  return vista;
}

// Stock por perspectiva al corte: solo abiertas (pendiente/parcial), sin
// eliminadas ni condonadas antes/el corte, y con saldo > 0 (B-3).
function stockAlCorte({ obligaciones, entregas, uid, corte }) {
  let pendienteCobro = 0;
  let pendienteDevolucion = 0;

  for (const obligacion of obligaciones) {
    const fecha = fechaEfectivaDe(obligacion);

    // La deuda existe si su fecha efectiva <= corte. Sin fecha, no existe.
    if (!fecha || fecha > corte) continue;

    const vista = vistaAlCorte(obligacion, entregas, corte);
    const estado = estadoDe(vista);

    if (estado !== "pendiente" && estado !== "parcial") continue;

    const saldo = saldoDe(vista);

    if (saldo <= 0) continue;

    if (sentidoDelViewer(vista, uid) === "por_cobrar") {
      pendienteCobro += saldo;
    } else {
      pendienteDevolucion += saldo;
    }
  }

  return { pendienteCobro, pendienteDevolucion };
}

// Condonaciones del mes (B-2): memo informativo por `condonacion.createdAt`.
// `ganadas` = deuda propia perdonada (por_devolver); `perdidas` = deuda a
// favor perdonada (por_cobrar). Monto = saldo perdonado. No mueven el
// movimiento; la eliminación (corrección) ya vino filtrada.
function condonacionesDelMes({ obligaciones, uid, desde, hasta }) {
  let ganadas = 0;
  let perdidas = 0;

  for (const obligacion of obligaciones) {
    if (!("condonacion" in obligacion)) continue;

    const cuando = aDate(obligacion.condonacion?.createdAt);

    // Sin fecha no se atribuye a ningún mes (no se inventa una).
    if (!cuando || !enRangoMes(cuando, desde, hasta)) continue;

    const monto = saldoDe(obligacion);

    if (monto <= 0) continue;

    if (sentidoDelViewer(obligacion, uid) === "por_devolver") {
      ganadas += monto;
    } else {
      perdidas += monto;
    }
  }

  return { ganadas, perdidas };
}

export function calcularBalanceDelMes({
  mes,
  uid,
  datos,
  ahora = new Date(),
  inversiones = 0,
} = {}) {
  const { desde, hasta } = rangoDelMes(mes);

  if (!uid) {
    throw new BalanceError("UID_REQUERIDO", "Falta el usuario del balance.");
  }

  const inversionesNetas = normalizarInversiones(inversiones);
  const corte = corteDe(mes, ahora);

  const gastos = datos?.gastos ?? [];
  const fixedEntries = datos?.fixedEntries ?? [];
  const ingresos = datos?.ingresos ?? [];
  const obligaciones = (datos?.obligaciones ?? []).filter(
    (obligacion) => !("eliminacion" in obligacion),
  );
  const entregas = (datos?.entregas ?? []).filter(
    (entrega) => !("eliminacion" in entrega),
  );

  // ── Flujos del mes (B-5: semiabierto; fecha efectiva con fallback) ──────
  const gastosMes = gastos.filter((gasto) =>
    enRangoMes(fechaEfectiva(gasto), desde, hasta),
  );
  const ingresosMes = ingresos.filter((ingreso) =>
    enRangoMes(fechaEfectiva(ingreso), desde, hasta),
  );

  // ── Egresos: la fórmula de /gastos, desglosada (B-6) ───────────────────
  const diarios = gastosMes
    .filter((gasto) => gasto.tipo === "personal" && gasto.usuario === uid)
    .reduce((acc, gasto) => acc + Number(gasto.monto || 0), 0);

  const compartidosDiarios = gastosMes
    .filter((gasto) => gasto.tipo === "compartido" && gasto.usuario === uid)
    .reduce((acc, gasto) => acc + Number(gasto.monto || 0), 0);

  const entriesMes = fixedEntries.filter(
    (entry) => entry.periodo === mes && esPagado(entry),
  );

  const fijosPersonales = entriesMes
    .filter((entry) => !entry.groupId)
    .reduce((acc, entry) => acc + parteDelUsuarioDeFijo(entry), 0);

  const fijosCompartidos = entriesMes
    .filter((entry) => entry.groupId)
    .reduce((acc, entry) => acc + parteDelUsuarioDeFijo(entry), 0);

  const totalEgresos =
    diarios + compartidosDiarios + fijosPersonales + fijosCompartidos;

  // ── Ingresos por moneda (B-7: nunca se suman) ──────────────────────────
  const ingresosUyu = sumarPorMoneda(ingresosMes, UYU);
  const ingresosUsd = sumarPorMoneda(ingresosMes, USD);
  const resultado = ingresosUyu - totalEgresos;

  // ── Reintegros del mes (reuso literal de modelo.js) ────────────────────
  const entradas = entradasDelMes({
    obligaciones,
    entregas,
    uid,
    start: desde,
    nextStart: hasta,
  });
  const salidas = salidasDelMes({
    obligaciones,
    entregas,
    uid,
    start: desde,
    nextStart: hasta,
  });
  const neto = entradas - salidas;

  // ── Condonaciones (informativo) y stock al corte (B-3) ─────────────────
  const condonaciones = condonacionesDelMes({
    obligaciones,
    uid,
    desde,
    hasta,
  });
  const { pendienteCobro, pendienteDevolucion } = stockAlCorte({
    obligaciones,
    entregas,
    uid,
    corte,
  });

  return {
    mes,
    rango: { desde, hasta },
    ingresos: { uyu: ingresosUyu, usd: ingresosUsd },
    egresos: {
      total: totalEgresos,
      diarios,
      compartidosDiarios,
      fijosPersonales,
      fijosCompartidos,
    },
    resultado,
    reintegros: { entradas, salidas, neto },
    inversiones: inversionesNetas,
    condonaciones,
    movimientoEsperado: resultado + neto + inversionesNetas,
    stock: { pendienteCobro, pendienteDevolucion, corte },
  };
}
