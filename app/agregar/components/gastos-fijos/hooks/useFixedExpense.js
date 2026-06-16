"use client";

import {
  useState,
  useMemo,
} from "react";

import { FIXED_EXPENSES } from "../helpers/fixedExpensesConfig";

export function useFixedExpense() {
  const PASOS = [
    "tipo",
    "detalle",
    "resumen",
  ];

  const [paso, setPaso] =
    useState("tipo");

  const [tipoId, setTipoId] =
    useState(null);

  const [item, setItem] =
    useState(null);

  const [monto, setMonto] =
    useState("");

  const [fecha, setFecha] =
    useState(
      new Date()
        .toISOString()
        .slice(0, 7),
    );

  const [
    selectedGroupId,
    setSelectedGroupId,
  ] = useState("");

  const tipos = useMemo(
    () => FIXED_EXPENSES,
    [],
  );

  function seleccionarTipo(id) {
    setTipoId(id);
  }

  function seleccionarItem(i) {
    setItem(i);

    setPaso("detalle");
  }

  return {
    PASOS,

    paso,
    setPaso,

    tipoId,
    setTipoId,

    item,
    setItem,

    monto,
    setMonto,

    fecha,
    setFecha,

    tipos,

    selectedGroupId,
    setSelectedGroupId,

    seleccionarTipo,
    seleccionarItem,
  };
}