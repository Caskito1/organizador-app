// ingresos/helpers/ingresosMoneda.js
// 5.0 — Sueldo multimoneda: ÚNICA fuente de la moneda de un ingreso.
// Puro (sin imports del SDK) para poder testearlo con node --test sin emulador
// y para que lo usen la app (Next) y el harness.
//
// Regla del módulo (D-2/D-7): la moneda NO se elige, se DERIVA del subtipo.
// `USD` está atado a `sueldo_dolares`; todo lo demás es `UYU`. Sin conversión,
// sin cotización y sin suma entre monedas en ningún total.

export const UYU = "UYU";
export const USD = "USD";

// Subtipos de Sueldo (D-7), en el orden canónico de la UI y de los grupos.
// El nombre de la plataforma que paga el sueldo en dólares NO aparece acá.
export const SUELDOS = [
  { id: "sueldo_pesos", label: "Sueldo en pesos" },
  { id: "sueldo_dolares", label: "Sueldo en dólares" },
  { id: "aguinaldo", label: "Aguinaldo" },
  { id: "salario_vacacional", label: "Salario vacacional" },
  { id: "otro", label: "Otro concepto" },
];

// Subtipo → moneda. ÚNICO lugar que decide la moneda: lo usan el alta
// (submitIngreso) y la edición (EditarIngresoModal).
export function monedaDeSubtipo(subtipo) {
  return subtipo === "sueldo_dolares" ? USD : UYU;
}

// Moneda efectiva del documento: `moneda` manda; sin campo (documentos
// anteriores a 5.0) se lee como UYU (D-6, sin migración).
export function monedaEfectiva(ingreso) {
  return ingreso?.moneda === USD ? USD : UYU;
}

// Símbolo para la UI. El peso usa `$` (como el resto de la app).
export function simboloDe(moneda) {
  return moneda === USD ? "US$" : "$";
}

// Σ de montos de los ítems de ESA moneda. Nunca suma entre monedas: es la
// garantía de D-4/D-9 en todos los totales.
export function sumarPorMoneda(items, moneda) {
  return (items ?? [])
    .filter((i) => monedaEfectiva(i) === moneda)
    .reduce((a, i) => a + Number(i.monto || 0), 0);
}

// Grupos de Sueldo por subtipo (D-8, patrón BandasSection): orden canónico de
// SUELDOS, el grupo legacy sin subtipo («Sueldo») al final (P-5/A-2) y los
// subtipos desconocidos (datos escritos fuera de la app) también al final.
export function agruparSueldoPorSubtipo(items) {
  const porId = new Map();
  for (const i of items ?? []) {
    const key = i.subtipo ?? null;
    const arr = porId.get(key) ?? [];
    arr.push(i);
    porId.set(key, arr);
  }

  const grupos = [];
  for (const s of SUELDOS) {
    if (porId.has(s.id)) {
      grupos.push({ id: s.id, label: s.label, items: porId.get(s.id) });
    }
  }
  if (porId.has(null)) {
    grupos.push({ id: null, label: "Sueldo", items: porId.get(null) });
  }
  for (const [id, items] of porId) {
    if (id === null) continue;
    if (SUELDOS.some((s) => s.id === id)) continue;
    grupos.push({ id, label: id, items });
  }
  return grupos;
}
