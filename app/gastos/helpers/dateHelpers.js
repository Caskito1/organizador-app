// gastos/helpers/dateHelpers.js
//
// 4.5-fecha: el gasto diario tiene una fecha propia (`fecha`, Timestamp).
// `createdAt` queda como auditoría inmutable. Los documentos históricos (sin
// `fecha`) se siguen leyendo con fallback a `createdAt`: no hay migración.
//
// Este archivo es PURO (sin imports del SDK) para poder testear el fallback
// con node --test sin emulador.

export function getMonthRange(date) {
  const start = new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
  );

  const end = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
  );

  return { start, end };
}

// Timestamp | Date | string → Date (o null). Duck-typing de `toDate` para no
// depender del SDK en este módulo.
export function aDate(valor) {
  if (!valor) return null;

  if (typeof valor.toDate === "function") {
    return valor.toDate();
  }

  const fecha = new Date(valor);

  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

// Fecha efectiva del gasto: `fecha` manda; `createdAt` es el fallback de los
// documentos cargados antes de 4.5-fecha (sin migración).
export function fechaEfectiva(item) {
  return aDate(item?.fecha) ?? aDate(item?.createdAt);
}

// 'YYYY-MM-DD' (input date) → Date a medianoche LOCAL del día elegido.
// Misma convención que DevolucionModal (reintegros): un parseo UTC correría
// el día —y el mes— en el borde. El caller lo envuelve en Timestamp.
export function fechaLocal(iso) {
  const [y, m, d] = iso.split("-").map(Number);

  return new Date(y, m - 1, d);
}

// Fecha → 'YYYY-MM-DD' local, para inicializar <input type="date">.
export function isoDeFecha(valor) {
  const fecha = aDate(valor);

  if (!fecha) return "";

  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");

  return `${fecha.getFullYear()}-${mm}-${dd}`;
}

export function hoyISO() {
  return isoDeFecha(new Date());
}
