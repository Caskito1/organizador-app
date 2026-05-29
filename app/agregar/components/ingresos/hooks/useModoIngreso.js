// components/ingresos/hooks/useModoIngreso.js

"use client";

import { useState } from "react";

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

  function seleccionarTipo(id) {
    setTipo(id);

    setSubtipo(null);

    if (id !== "banda") {
      setPaso("detalle");
    }
  }

  function seleccionarBanda(id) {
    setTipo("banda");

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
    )?.label ?? null;

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

    tipoLabel,
    subtipoLabel,

    seleccionarTipo,
    seleccionarBanda,
  };
}