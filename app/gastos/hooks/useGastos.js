"use client";

import { useEffect, useState } from "react";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { useGroups } from "@/lib/GroupContext";
import { db } from "@/lib/firebase";
import {
  getMonthRange,
  fechaEfectiva,
  porFechaDesc,
} from "../helpers/dateHelpers";
import {
  esPagado,
  parteDelUsuarioDeFijo,
} from "../helpers/fijosCriterio";
import subscribeGastos from "../services/subscribeGastos";
import subscribeFixedExpenses from "../services/subscribeFixedExpenses";

export default function useGastos(mesActual) {
  const { user } = useAuth();
  const { groups, loadingGroups } = useGroups();

  const [loading, setLoading] = useState(true);
  const [gastos, setGastos] = useState([]);
  const [fixedEntries, setFixedEntries] = useState([]);
  const [openSection, setOpenSection] = useState(null);
  const [editingGasto, setEditingGasto] = useState(null);

  useEffect(() => {
    if (!user || loadingGroups) return;
    const unsubscribe = subscribeGastos({
      user, groups,
      onChange: ({ gastos }) => {
        setGastos(gastos);
      },
      onLoaded: () => setLoading(false),
    });
    return unsubscribe;
  }, [user, groups, loadingGroups]);

  useEffect(() => {
    if (!user || loadingGroups) return;
    const grupo = groups[0] ?? null;
    const y = mesActual.getFullYear();
    const m = String(mesActual.getMonth() + 1).padStart(2, "0");
    const periodo = `${y}-${m}`;
    const unsubscribe = subscribeFixedExpenses({ user, grupo, periodo, onChange: setFixedEntries });
    return unsubscribe;
  }, [user, groups, loadingGroups, mesActual]);

  function toggleSection(key) {
    setOpenSection((prev) => (prev === key ? null : key));
  }

  const { start, end } = getMonthRange(mesActual);

  // 4.5-fecha: el período se deriva de `fecha` (fecha del gasto) y, en los
  // documentos históricos sin ese campo, de `createdAt` (fallback).
  function enMes(item) {
    const fecha = fechaEfectiva(item);
    return !!fecha && fecha >= start && fecha <= end;
  }

  const gastosMes = gastos.filter(enMes);

  const gastosPersonalesBase = gastosMes.filter(
    (g) => g.tipo === "personal" && g.usuario === user?.uid,
  );

  const gastosPersonales = gastosPersonalesBase.sort(porFechaDesc);

  const gastosPorGrupo = groups.map((grupo) => {
    const gastosGrupo = gastosMes
      .filter((g) => g.tipo === "compartido" && g.groupId === grupo.id)
      .sort(porFechaDesc);
    const totalGrupo = gastosGrupo.reduce((a, g) => a + Number(g.monto || 0), 0);
    const totalUsuario = gastosGrupo
      .filter((g) => g.usuario === user?.uid)
      .reduce((a, g) => a + Number(g.monto || 0), 0);
    return { grupo, gastos: gastosGrupo, totalGrupo, totalUsuario };
  });

  const fixedCompartidos = fixedEntries
  .filter((e) => e.groupId)
  .map((e) => ({
    ...e,
    montoPersonal: parteDelUsuarioDeFijo(e),
  }));

const fixedPersonales = fixedEntries
  .filter((e) => !e.groupId)
  .map((e) => ({
    ...e,
    montoPersonal: parteDelUsuarioDeFijo(e),
  }));
  // Total del mes / Total real: solo entra lo EFECTIVAMENTE PAGADO.
  // El criterio vive en ../helpers/fijosCriterio (5.1, A-1): `esPagado` y la
  // parte 50 %/100 %, compartidos con el balance. NO usar `estado`: "saldado"
  // es balance, no pago, y "pagado_hasta" se calcula antes de verificar el
  // pago (useFixedExpenses.js:120-121). El anual vigente cuenta aunque
  // paidByUid sea null (registrarGasto lo resetea).

  const fixedPagadas = fixedEntries.filter(esPagado);

  const totalFixedReal = fixedPagadas.reduce(
  (a, e) => a + Number(e.montoTotal || 0),
  0,
);
 const totalFixed = fixedPagadas.reduce(
  (a, e) => a + parteDelUsuarioDeFijo(e),
  0,
);

  const totalPersonales = gastosPersonales.reduce((a, g) => a + Number(g.monto || 0), 0);
  const totalGruposUsuario = gastosPorGrupo.reduce((a, g) => a + g.totalUsuario, 0);

  // Total = personales + mi parte de grupos + fijos
  const totalGastos = totalPersonales + totalGruposUsuario + totalFixed;

  const totalTransacciones =
    gastosPersonales.length +
    gastosPorGrupo.reduce((a, { gastos }) => a + gastos.length, 0);

  // ─── ACCIONES ───────────────────────────────────────────

  async function editarGasto(id, payload) {
    await updateDoc(doc(db, "gastos", id), payload);
  }

  async function eliminarGasto(id) {
    await deleteDoc(doc(db, "gastos", id));
  }

  return {
    loading,
    loadingGroups,
    groups,
    user,
    gastosPersonales,
    gastosPorGrupo,
    fixedCompartidos,
    fixedPersonales,
    totalFixed,
    totalFixedReal,
    totalGastos,
    totalTransacciones,
    openSection,
    toggleSection,
    editingGasto,
    setEditingGasto,
    editarGasto,
    eliminarGasto,
  };
}