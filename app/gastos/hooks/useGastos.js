"use client";

import { useEffect, useState } from "react";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { useGroups } from "@/lib/GroupContext";
import { db } from "@/lib/firebase";
import { getMonthRange } from "../helpers/dateHelpers";
import subscribeGastos from "../services/subscribeGastos";
import subscribeFixedExpenses from "../services/subscribeFixedExpenses";

export default function useGastos(mesActual) {
  const { user } = useAuth();
  const { groups, loadingGroups } = useGroups();

  const [loading, setLoading] = useState(true);
  const [gastos, setGastos] = useState([]);
  const [transferencias, setTransferencias] = useState([]);
  const [fixedEntries, setFixedEntries] = useState([]);
  const [openSection, setOpenSection] = useState(null);
  const [editingGasto, setEditingGasto] = useState(null);

  useEffect(() => {
    if (!user || loadingGroups) return;
    const unsubscribe = subscribeGastos({
      user, groups,
      onChange: ({ gastos, transferencias }) => {
        setGastos(gastos);
        setTransferencias(transferencias);
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

  function enMes(item) {
    if (!item.createdAt) return false;
    const fecha = item.createdAt?.toDate?.() ?? new Date(item.createdAt);
    return fecha >= start && fecha <= end;
  }

  const gastosMes = gastos.filter(enMes);
  const transferenciasMes = transferencias.filter(enMes);

  const gastosPersonalesBase = gastosMes.filter(
    (g) => g.tipo === "personal" && g.usuario === user?.uid,
  );

  const transferenciasEnviadas = transferenciasMes
    .filter((t) => t.deUid === user?.uid)
    .map((t) => ({
      ...t,
      id: "transfer-" + t.id,
      tipo: "transferencia",
      producto: "Transferencia",
      detalle: t.concepto === "otros" ? t.detalle : t.concepto,
      usuarioNombre: t.paraNombre,
    }));

  const gastosPersonales = [...gastosPersonalesBase, ...transferenciasEnviadas].sort((a, b) => {
    const fa = a.createdAt?.toDate?.() ?? new Date(a.createdAt);
    const fb = b.createdAt?.toDate?.() ?? new Date(b.createdAt);
    return fb - fa;
  });

  const gastosPorGrupo = groups.map((grupo) => {
    const gastosGrupo = gastosMes.filter(
      (g) => g.tipo === "compartido" && g.groupId === grupo.id,
    );
    const totalGrupo = gastosGrupo.reduce((a, g) => a + Number(g.monto || 0), 0);
    const totalUsuario = gastosGrupo
      .filter((g) => g.usuario === user?.uid)
      .reduce((a, g) => a + Number(g.monto || 0), 0);
    return { grupo, gastos: gastosGrupo, totalGrupo, totalUsuario };
  });

  const fixedCompartidos = fixedEntries.filter((e) => e.groupId);
  const fixedPersonales = fixedEntries.filter((e) => !e.groupId);
  const totalFixed = fixedEntries.reduce((a, e) => a + Number(e.montoTotal || 0), 0);

  const totalPersonales = gastosPersonales.reduce((a, g) => a + Number(g.monto || 0), 0);
  const totalGruposUsuario = gastosPorGrupo.reduce((a, g) => a + g.totalUsuario, 0);

  // Total = personales + transferencias enviadas + mi parte de grupos + fijos
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