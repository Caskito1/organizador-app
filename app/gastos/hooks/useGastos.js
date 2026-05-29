"use client";

import {
  useEffect,
  useState,
} from "react";

import { useAuth } from "@/lib/AuthContext";

import { useGroups } from "@/lib/GroupContext";

import { getMonthRange } from "../helpers/dateHelpers";

import subscribeGastos from "../services/subscribeGastos";

export default function useGastos(
  mesActual,
) {
  const { user } = useAuth();

  const {
    groups,
    loadingGroups,
  } = useGroups();

  const [loading, setLoading] =
    useState(true);

  const [gastos, setGastos] =
    useState([]);

  const [
    transferencias,
    setTransferencias,
  ] = useState([]);

  const [openSections, setOpenSections] =
    useState({
      personal: true,
    });

  useEffect(() => {
    if (
      !user ||
      loadingGroups
    )
      return;

    const unsubscribe =
      subscribeGastos({
        user,
        groups,

        onChange: ({
          gastos,
          transferencias,
        }) => {
          setGastos(gastos);

          setTransferencias(
            transferencias,
          );
        },

        onLoaded: () =>
          setLoading(false),
      });

    return unsubscribe;
  }, [
    user,
    groups,
    loadingGroups,
  ]);

  function toggleSection(key) {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  const { start, end } =
    getMonthRange(mesActual);

  function enMes(item) {
    if (!item.createdAt)
      return false;

    const fecha =
      item.createdAt?.toDate?.() ??
      new Date(item.createdAt);

    return (
      fecha >= start &&
      fecha <= end
    );
  }

  const gastosMes =
    gastos.filter(enMes);

  const transferenciasMes =
    transferencias.filter(enMes);

  /* GASTOS PERSONALES */

  const gastosPersonalesBase =
    gastosMes.filter(
      (g) =>
        g.tipo === "personal" &&
        g.usuario === user?.uid,
    );

  /* TRANSFERENCIAS ENVIADAS */

  const transferenciasEnviadas =
    transferenciasMes
      .filter(
        (t) =>
          t.deUid === user?.uid,
      )
      .map((t) => ({
        ...t,

        id:
          "transfer-" + t.id,

        tipo:
          "transferencia",

        producto:
          "Transferencia",

        detalle:
          t.concepto === "otros"
            ? t.detalle
            : t.concepto,

        usuarioNombre:
          t.paraNombre,
      }));

  /* MEZCLA PERSONALES */

  const gastosPersonales = [
    ...gastosPersonalesBase,
    ...transferenciasEnviadas,
  ].sort((a, b) => {
    const fa =
      a.createdAt?.toDate?.() ??
      new Date(a.createdAt);

    const fb =
      b.createdAt?.toDate?.() ??
      new Date(b.createdAt);

    return fb - fa;
  });

  /* GRUPOS */

  const gastosPorGrupo =
    groups.map((grupo) => {
      const gastosGrupo =
        gastosMes.filter(
          (g) =>
            g.tipo ===
              "compartido" &&
            g.groupId === grupo.id,
        );

      /* TOTAL DEL GRUPO */

      const totalGrupo =
        gastosGrupo.reduce(
          (a, g) =>
            a +
            Number(g.monto || 0),
          0,
        );

      /* LO TUYO */

      const totalUsuario =
        gastosGrupo
          .filter(
            (g) =>
              g.usuario ===
              user?.uid,
          )
          .reduce(
            (a, g) =>
              a +
              Number(g.monto || 0),
            0,
          );

      return {
        grupo,

        gastos: gastosGrupo,

        totalGrupo,

        totalUsuario,
      };
    });

  /* TOTAL PERSONALES */

  const totalPersonales =
    gastosPersonales.reduce(
      (a, g) =>
        a + Number(g.monto || 0),
      0,
    );

  /* TOTAL TUYO EN GRUPOS */

  const totalGruposUsuario =
    gastosPorGrupo.reduce(
      (a, grupo) =>
        a + grupo.totalUsuario,
      0,
    );

  /* TOTAL FINAL */

  const totalGastos =
    totalPersonales +
    totalGruposUsuario;

  /* TRANSACCIONES */

  const totalTransacciones =
    gastosPersonales.length +
    gastosPorGrupo.reduce(
      (a, { gastos }) =>
        a + gastos.length,
      0,
    );

  return {
    loading,

    loadingGroups,

    groups,

    user,

    gastosPersonales,

    gastosPorGrupo,

    totalGastos,

    totalTransacciones,

    openSections,

    toggleSection,
  };
}