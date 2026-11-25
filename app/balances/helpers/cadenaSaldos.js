// balances/helpers/cadenaSaldos.js
// Cadena de saldos, persistencia normalizada y métricas de la tendencia (5.2).
// PURO (sin SDK, sin alias @/…): lo importan la app, el service y los tests.
//
// Reglas (plan §5.2.4):
//  - inicio(M) = cierreReal(M-1) ?? cajaAlInicio(M) ?? null
//  - esperada(M) = inicio(M) + movimientoEsperado(M)
//  - diferencia(M) = esperada(M) - cierreReal(M)
//  - el cierre real del mes en curso se IGNORA (P-5)
//  - un cierre de dos meses atrás NO se arrastra a través de un hueco

const MES_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

// 5.2-bis: la tendencia muestra como máximo 5 meses (el seleccionado y los 4
// anteriores). El tope puede vivir en `ventanaMeses` porque la ventana siempre
// contiene el mes seleccionado; el piso, en cambio, se aplica solo a la
// tendencia y nunca a las filas del ledger (ver `filtrarTendencia`).
export const MESES_TENDENCIA = 5;

// Piso de la tendencia: los meses previos a 2026-09 no están completos (cargas
// parciales). Se elimina cuando esos meses previos estén completos.
export const PRIMER_MES_CONFIABLE = "2026-09";

// Date → 'YYYY-MM' local.
export function mesISO(fecha) {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) return "";

  const anio = fecha.getFullYear();
  const numero = String(fecha.getMonth() + 1).padStart(2, "0");

  return `${anio}-${numero}`;
}

// 'YYYY-MM' + delta → 'YYYY-MM' (o null si el mes no es válido).
export function sumarMeses(mes, delta) {
  if (typeof mes !== "string" || !MES_RE.test(mes)) return null;

  const [anio, numero] = mes.split("-").map(Number);

  return mesISO(new Date(anio, numero - 1 + delta, 1));
}

// Ventana de N meses terminando en `mes` (orden viejo → nuevo).
export function ventanaMeses(mes, cantidad = MESES_TENDENCIA) {
  const meses = [];

  for (let i = cantidad - 1; i >= 0; i -= 1) {
    const anterior = sumarMeses(mes, -i);

    if (anterior) meses.push(anterior);
  }

  return meses;
}

function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;

  const n = Number(valor);

  return Number.isFinite(n) ? n : null;
}

function entero(valor) {
  const n = numero(valor);

  return Number.isInteger(n) ? n : null;
}

function enteroNoNegativo(valor) {
  const n = entero(valor);

  return n !== null && n >= 0 ? n : null;
}

// Sanitiza `balances` del doc del usuario. Valores inválidos se ignoran.
export function normalizarMeses(balances) {
  const meses = balances?.meses;

  if (!meses || typeof meses !== "object") return {};

  const salida = {};

  for (const [mes, valor] of Object.entries(meses)) {
    if (!MES_RE.test(mes) || !valor || typeof valor !== "object") continue;

    const limpio = {};

    if (valor.inversiones && typeof valor.inversiones === "object") {
      const aportes = enteroNoNegativo(valor.inversiones.aportes);
      const rescates = enteroNoNegativo(valor.inversiones.rescates);

      if (aportes !== null || rescates !== null) {
        limpio.inversiones = {
          aportes: aportes ?? 0,
          rescates: rescates ?? 0,
        };
      }
    }

    const inicio = entero(valor.cajaAlInicio);
    if (inicio !== null) limpio.cajaAlInicio = inicio;

    const cierre = entero(valor.cajaRealAlCierre);
    if (cierre !== null) limpio.cajaRealAlCierre = cierre;

    if (Object.keys(limpio).length > 0) salida[mes] = limpio;
  }

  return salida;
}

// Neto de inversiones del mes (rescates + / aportes −), input de 5.1.
export function netoInversiones(prefsMes) {
  const inversiones = prefsMes?.inversiones;

  if (!inversiones) return 0;

  return (
    Number(inversiones.rescates ?? 0) - Number(inversiones.aportes ?? 0)
  );
}

// Filas de la ventana: balance de 5.1 + cadena de saldos.
export function construirFilas({ meses, balancesPorMes, preferencias, ahora }) {
  const mesActual = mesISO(ahora);
  const prefs = preferencias?.meses ?? {};

  return meses.map((mes) => {
    const balance = balancesPorMes?.[mes];
    const prefsMes = prefs[mes] ?? {};
    const esEnCurso = mes === mesActual;
    const cierreAnterior = entero(
      prefs[sumarMeses(mes, -1)]?.cajaRealAlCierre,
    );
    const ancla = entero(prefsMes.cajaAlInicio);
    const cajaAlInicio = cierreAnterior ?? ancla;
    const origenInicio =
      cierreAnterior !== null
        ? "arrastre"
        : ancla !== null
          ? "ancla"
          : null;
    const cajaRealAlCierre = esEnCurso
      ? null
      : entero(prefsMes.cajaRealAlCierre);
    const movimiento = Number(balance?.movimientoEsperado ?? 0);
    const cajaEsperadaAlCierre =
      cajaAlInicio !== null ? cajaAlInicio + movimiento : null;
    const diferencia =
      cajaEsperadaAlCierre !== null && cajaRealAlCierre !== null
        ? cajaEsperadaAlCierre - cajaRealAlCierre
        : null;

    return {
      mes,
      balance,
      esEnCurso,
      cajaAlInicio,
      origenInicio,
      cajaRealAlCierre,
      cajaEsperadaAlCierre,
      diferencia,
    };
  });
}

function tieneActividad(fila) {
  const balance = fila.balance;

  if (!balance) return false;

  return (
    balance.ingresos?.uyu > 0 ||
    balance.ingresos?.usd > 0 ||
    balance.egresos?.total > 0 ||
    balance.reintegros?.entradas !== 0 ||
    balance.reintegros?.salidas !== 0 ||
    balance.inversiones !== 0
  );
}

// Desde el primer mes con actividad (los anteriores no se dibujan).
export function filasDesdePrimerDato(filas) {
  const indice = filas.findIndex(tieneActividad);

  return indice === -1 ? [] : filas.slice(indice);
}

// Meses con cierre real y esperada calculable (gráfico 3).
export function filasConCierre(filas) {
  return filas.filter((fila) => fila.diferencia !== null);
}

// ¿Hay actividad en la ventana? Incluye los meses previos al piso: sirve para
// distinguir «sin datos» de «sin meses confiables» en la tendencia.
export function hayActividad(filas) {
  return filas.some(tieneActividad);
}

// La tendencia arranca en el piso (2026-09), pero solo para la tendencia: no se
// aplica a `ventanaMeses` ni a las filas del ledger del mes seleccionado.
export function filtrarTendencia(filas, piso = PRIMER_MES_CONFIABLE) {
  return filas.filter((fila) => fila.mes >= piso);
}

// Estado de la tendencia: «ok» | «sin-datos» | «sin-confiables».
export function estadoTendencia(filas, piso = PRIMER_MES_CONFIABLE) {
  const confiables = filtrarTendencia(filas, piso);

  if (filasDesdePrimerDato(confiables).length > 0) return "ok";

  return hayActividad(filas) ? "sin-confiables" : "sin-datos";
}

// Métricas de la tendencia. Recibe las filas ya filtradas por
// `filtrarTendencia` (el hook aplica el piso antes de llamarla).
export function metricasTendencia(filas) {
  const dibujadas = filasDesdePrimerDato(filas);
  const cantidad = dibujadas.length;
  const promedio = (fn) =>
    cantidad === 0
      ? null
      : dibujadas.reduce((acc, fila) => acc + fn(fila), 0) / cantidad;
  const conCierre = filasConCierre(filas);

  return {
    promedioIngresos: promedio((fila) =>
      Number(fila.balance?.ingresos?.uyu ?? 0),
    ),
    promedioEgresos: promedio((fila) =>
      Number(fila.balance?.egresos?.total ?? 0),
    ),
    acumuladoMovimiento: dibujadas.reduce(
      (acc, fila) => acc + Number(fila.balance?.movimientoEsperado ?? 0),
      0,
    ),
    promedioGap:
      conCierre.length === 0
        ? null
        : conCierre.reduce((acc, fila) => acc + fila.diferencia, 0) /
          conCierre.length,
    mesesDibujados: cantidad,
    mesesConCierre: conCierre.length,
  };
}
