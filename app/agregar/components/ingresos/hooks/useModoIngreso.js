// components/ingresos/hooks/useModoIngreso.js

"use client";

import { useState } from "react";

import { hoyISO } from "@/app/gastos/helpers/dateHelpers";
import { SUELDOS } from "@/app/ingresos/helpers/ingresosMoneda";

export { SUELDOS };

export const BANDAS = [
  {
    id: "laventolera",
    label: "La Ventolera",
  },
  {
    id: "laimbailable",
    label: "La Imbailable",
  },
  {
    id: "tapelao",
    label: "Tapelao",
  },
];

export function useModoIngreso() {
  const PASOS_I = [
    "tipo",
    "detalle",
  ];

  const [paso, setPaso] =
    useState("tipo");

  const [tipo, setTipo] =
    useState(null);

  const [subtipo, setSubtipo] =
    useState(null);

  const [monto, setMonto] =
    useState("");

  const [detalle, setDetalle] =
    useState("");

  // 4.5-fecha: fecha del ingreso (default hoy). Obligatoria en la app.
  const [fecha, setFecha] =
    useState(hoyISO);

  function seleccionarTipo(id) {
    setTipo(id);

    setSubtipo(null);

    // 5.0: Sueldo espera su subtipo (igual que Bandas), porque el subtipo es
    // lo que fija la moneda. El resto de los tipos avanza directo.
    if (id !== "banda" && id !== "sueldo") {
      setPaso("detalle");
    }
  }

  function seleccionarBanda(id) {
    setTipo("banda");

    setSubtipo(id);

    setPaso("detalle");
  }

  // 5.0 (D-7): espejo de seleccionarBanda. Elegir el subtipo fija la moneda
  // por derivación (monedaDeSubtipo) — no hay selector de moneda.
  function seleccionarSueldo(id) {
    setTipo("sueldo");

    setSubtipo(id);

    setPaso("detalle");
  }


const tipoLabel = {
  sueldo: "Sueldo",
  freelance: "Freelance",
  banda: "Bandas",
   otros: "Otros",
}[tipo];

  const subtipoLabel =
    BANDAS.find(
      (b) => b.id === subtipo,
    )?.label ??
    SUELDOS.find(
      (s) => s.id === subtipo,
    )?.label ??
    null;

  return {
    PASOS_I,

    paso,
    setPaso,

    tipo,
    setTipo,

    subtipo,
    setSubtipo,

    monto,
    setMonto,

    detalle,
    setDetalle,

    fecha,
    setFecha,

    tipoLabel,
    subtipoLabel,

    seleccionarTipo,
    seleccionarBanda,
    seleccionarSueldo,
  };
}