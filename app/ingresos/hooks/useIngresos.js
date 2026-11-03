// ingresos/hooks/useIngresos.js

"use client";

import { useEffect, useMemo, useState } from "react";

import { doc, updateDoc, deleteDoc } from "firebase/firestore";

import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";

import {
  getMonthRange,
  fechaEfectiva,
  porFechaDesc,
} from "@/app/gastos/helpers/dateHelpers";

import { subscribeIngresos } from "../services/subscribeIngresos";

export default function useIngresos(
  selectedMonth,
) {
  const { user } = useAuth();

  const [loading, setLoading] =
    useState(true);

  const [ingresos, setIngresos] =
    useState([]);

  const [editingIngreso, setEditingIngreso] =
    useState(null);

  const [openSections, setOpenSections] =
    useState({
      sueldo: true,
      bandas: true,
      freelance: true,
      otros: true,
    });

  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);

    const unsubscribe =
      subscribeIngresos({
        uid: user.uid,

        onData: ({ ingresos }) => {
          setIngresos(ingresos);

          setLoading(false);
        },
      });

    return () => unsubscribe?.();
  }, [user?.uid]);

  // 4.5-fecha: el período se deriva en cliente con `fechaEfectiva`
  // (`fecha` ?? `createdAt`) — la query ya no filtra por fecha, así que los
  // documentos históricos sin `fecha` siguen entrando.
  const ingresosMes = useMemo(() => {
    const { start, end } =
      getMonthRange(selectedMonth);

    return ingresos
      .filter((i) => {
        const fecha = fechaEfectiva(i);

        return !!fecha && fecha >= start && fecha <= end;
      })
      .sort(porFechaDesc);
  }, [ingresos, selectedMonth]);

  const ingresosSueldo =
    useMemo(() => {
      return ingresosMes.filter(
        (i) => i.tipo === "sueldo",
      );
    }, [ingresosMes]);

  const ingresosBandas =
    useMemo(() => {
      return ingresosMes.filter(
        (i) => i.tipo === "banda",
      );
    }, [ingresosMes]);

  const ingresosFreelance =
    useMemo(() => {
      return ingresosMes.filter(
        (i) =>
          i.tipo === "freelance",
      );
    }, [ingresosMes]);

  const ingresosOtros =
    useMemo(() => {
      return ingresosMes.filter(
        (i) => i.tipo === "otros",
      );
    }, [ingresosMes]);

  // 4.5: solo ingresos reales. Las transferencias legacy ya no suman (I-1).
  const totalIngresos =
    useMemo(() => {
      return ingresosMes.reduce(
        (a, i) =>
          a +
          Number(i.monto || 0),
        0,
      );
    }, [ingresosMes]);

  function toggleSection(key) {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  // 4.5-fecha: edición y borrado de ingresos (antes no existían).
  // `createdAt` nunca se envía: queda inmutable (auditoría).
  async function editarIngreso(id, payload) {
    await updateDoc(
      doc(db, "ingresos", id),
      payload,
    );
  }

  async function eliminarIngreso(id) {
    await deleteDoc(
      doc(db, "ingresos", id),
    );
  }

  return {
    loading,

    ingresosSueldo,
    ingresosBandas,
    ingresosFreelance,
    ingresosOtros,

    totalIngresos,

    openSections,
    toggleSection,

    editingIngreso,
    setEditingIngreso,
    editarIngreso,
    eliminarIngreso,
  };
}
