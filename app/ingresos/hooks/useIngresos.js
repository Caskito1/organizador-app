// ingresos/hooks/useIngresos.js

"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/lib/AuthContext";

import { subscribeIngresos } from "../services/subscribeIngresos";

export default function useIngresos(
  selectedMonth,
) {
  const { user } = useAuth();

  const [loading, setLoading] =
    useState(true);

  const [ingresos, setIngresos] =
    useState([]);

  const [
    transferenciasRecibidas,
    setTransferenciasRecibidas,
  ] = useState([]);

  const [openSections, setOpenSections] =
    useState({
      sueldo: true,
      bandas: true,
      freelance: true,
      transferencias: true,
    });

  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);

    const unsubscribe =
      subscribeIngresos({
        uid: user.uid,

        selectedMonth,

        onData: ({
          ingresos,
          transferencias,
        }) => {
          setIngresos(ingresos);

          setTransferenciasRecibidas(
            transferencias,
          );

          setLoading(false);
        },
      });

    return () => unsubscribe?.();
  }, [user?.uid, selectedMonth]);

  const ingresosSueldo =
    useMemo(() => {
      return ingresos.filter(
        (i) => i.tipo === "sueldo",
      );
    }, [ingresos]);

  const ingresosBandas =
    useMemo(() => {
      return ingresos.filter(
        (i) => i.tipo === "banda",
      );
    }, [ingresos]);

  const ingresosFreelance =
    useMemo(() => {
      return ingresos.filter(
        (i) =>
          i.tipo === "freelance",
      );
    }, [ingresos]);

  const totalIngresos =
    useMemo(() => {
      const totalIngresosDocs =
        ingresos.reduce(
          (a, i) =>
            a +
            Number(i.monto || 0),
          0,
        );

      const totalTransferencias =
        transferenciasRecibidas.reduce(
          (a, t) =>
            a +
            Number(t.monto || 0),
          0,
        );

      return (
        totalIngresosDocs +
        totalTransferencias
      );
    }, [
      ingresos,
      transferenciasRecibidas,
    ]);

  function toggleSection(key) {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  return {
    loading,

    ingresosSueldo,
    ingresosBandas,
    ingresosFreelance,

    transferenciasRecibidas,

    totalIngresos,

    openSections,
    toggleSection,
  };
}