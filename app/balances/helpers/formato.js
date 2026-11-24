// balances/helpers/formato.js
// Formato PURO de la página /balances (es-AR, como el resto de la app).
// Sin SDK ni alias @/…: lo usan la app y los unitarios.

const MES_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

function entero(valor) {
  const numero = Math.round(Number(valor) || 0);

  return Number.isFinite(numero) ? numero : 0;
}

// 'YYYY-MM' → Date local del día 1 (o null).
export function fechaDeMes(mes) {
  const match = typeof mes === "string" ? MES_RE.exec(mes) : null;

  if (!match) return null;

  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}

// Montos enteros en pesos: `$1.234` / `-$1.234`.
export function formatearMonto(valor) {
  const numero = entero(valor);
  const absoluto = Math.abs(numero).toLocaleString("es-AR");

  return numero < 0 ? `-$${absoluto}` : `$${absoluto}`;
}

// Monto de flujo con signo explícito: `+$1.234` / `-$1.234` / `$0`.
export function formatearMontoConSigno(valor) {
  const numero = entero(valor);

  if (numero === 0) return "$0";

  return numero > 0 ? `+${formatearMonto(numero)}` : formatearMonto(numero);
}

// Montos en dólares: `US$ 800` / `-US$ 800`.
export function formatearUSD(valor) {
  const numero = entero(valor);
  const absoluto = Math.abs(numero).toLocaleString("es-AR");

  return numero < 0 ? `-US$ ${absoluto}` : `US$ ${absoluto}`;
}

// 'YYYY-MM' → «octubre 2026».
export function etiquetaMes(mes) {
  const fecha = fechaDeMes(mes);

  if (!fecha) return "";

  return `${fecha.toLocaleString("es-AR", { month: "long" })} ${fecha.getFullYear()}`;
}

// 'YYYY-MM' → «oct» (etiqueta de eje).
export function etiquetaMesCorto(mes) {
  const fecha = fechaDeMes(mes);

  if (!fecha) return "";

  return fecha.toLocaleString("es-AR", { month: "short" }).replace(".", "");
}

// «octubre 2026 · en curso».
export function etiquetaConCurso(mes, esEnCurso) {
  const base = etiquetaMes(mes);

  if (!base) return "";

  return esEnCurso ? `${base} · en curso` : base;
}

// Date | Timestamp → «31/10/2026».
export function formatearFecha(fecha) {
  const valor = fecha?.toDate?.() ?? new Date(fecha);

  if (Number.isNaN(valor.getTime())) return "";

  return valor.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
