// balances/helpers/detalleMes.js
// Detalle del mes por sección (5.2, C-8) SIN duplicar la lógica de 5.1.
// Los egresos y reintegros se proyectan del contrato; los ingresos por tipo se
// derivan de los mismos documentos con las piezas puras de 4.5-fecha y 5.0.

import { fechaEfectiva } from "../../gastos/helpers/dateHelpers.js";
import { enRangoMes } from "../../reintegros/helpers/modelo.js";
import {
  UYU,
  USD,
  sumarPorMoneda,
} from "../../ingresos/helpers/ingresosMoneda.js";

export const TIPOS_INGRESO = [
  { id: "sueldo", label: "Sueldo" },
  { id: "banda", label: "Bandas" },
  { id: "freelance", label: "Freelance" },
  { id: "otros", label: "Otros" },
];

export function detalleIngresos({ ingresos = [], rango } = {}) {
  const desde = rango?.desde;
  const hasta = rango?.hasta;

  if (!desde || !hasta) return [];

  const delMes = ingresos.filter((ingreso) =>
    enRangoMes(fechaEfectiva(ingreso), desde, hasta),
  );

  return TIPOS_INGRESO.map(({ id, label }) => {
    const items = delMes.filter((ingreso) => ingreso.tipo === id);

    return {
      id,
      label,
      cantidad: items.length,
      uyu: sumarPorMoneda(items, UYU),
      usd: sumarPorMoneda(items, USD),
    };
  }).filter((grupo) => grupo.cantidad > 0);
}

export function detalleEgresos(balance) {
  const egresos = balance?.egresos ?? {};

  return [
    { id: "diarios", label: "Gastos diarios", monto: egresos.diarios ?? 0 },
    {
      id: "compartidosDiarios",
      label: "Compartidos diarios (mi parte)",
      monto: egresos.compartidosDiarios ?? 0,
    },
    {
      id: "fijosPersonales",
      label: "Fijos personales",
      monto: egresos.fijosPersonales ?? 0,
    },
    {
      id: "fijosCompartidos",
      label: "Fijos compartidos (50 %)",
      monto: egresos.fijosCompartidos ?? 0,
    },
  ];
}

export function detalleReintegros(balance) {
  const reintegros = balance?.reintegros ?? {};

  return [
    { id: "entradas", label: "Entradas", monto: reintegros.entradas ?? 0 },
    { id: "salidas", label: "Salidas", monto: reintegros.salidas ?? 0 },
    { id: "neto", label: "Neto", monto: reintegros.neto ?? 0 },
  ];
}
