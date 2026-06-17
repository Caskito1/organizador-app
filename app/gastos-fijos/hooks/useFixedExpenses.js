"use client";

import {
  collection, onSnapshot, query, where,
  doc, updateDoc, addDoc, serverTimestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useGroups } from "@/lib/GroupContext";
import { db } from "@/lib/firebase";
import {
  GASTOS_FIJOS_COMPARTIDOS,
  GASTOS_FIJOS_COMPARTIDOS_MAP,
  GASTOS_FIJOS_PERSONALES_CATALOGO,
} from "@/lib/fixedExpensesTaxonomia";

function getPeriodo(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function periodoMayorA(a, b) { return a > b; }

export default function useFixedExpenses(mesActual) {
  const { user } = useAuth();
  const { groups, loadingGroups } = useGroups();

  // Config personal del usuario (fixed_expenses collection)
  const [userConfig, setUserConfig] = useState([]);
  const [personalEntries, setPersonalEntries] = useState([]);
  const [sharedEntries, setSharedEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openItems, setOpenItems] = useState({});

  const periodo = getPeriodo(mesActual);
  const grupo = groups[0] ?? null;

  // 1. Leer config personal del usuario (qué gastos activó y con qué monto)
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "fixed_expenses"),
      where("usuario", "==", user.uid),
      where("activo", "==", true),
    );
    return onSnapshot(q, (snap) => {
      setUserConfig(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("userConfig error:", err));
  }, [user]);

  // 2. Entries del mes — personales
  useEffect(() => {
    if (!user || loadingGroups) return;
    const q = query(
      collection(db, "fixed_expense_entries"),
      where("usuario", "==", user.uid),
      where("periodo", "==", periodo),
    );
    return onSnapshot(q, (snap) => {
      setPersonalEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => { console.error("personal entries error:", err); setLoading(false); });
  }, [user, loadingGroups, periodo]);

  // 3. Entries del mes — compartidas
  useEffect(() => {
    if (!grupo?.id) return;
    const q = query(
      collection(db, "fixed_expense_entries"),
      where("groupId", "==", grupo.id),
      where("periodo", "==", periodo),
    );
    return onSnapshot(q, (snap) => {
      setSharedEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("shared entries error:", err));
  }, [grupo?.id, periodo]);

  // 4. Entries anuales vigentes
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "fixed_expense_entries"),
      where("usuario", "==", user.uid),
    );
    return onSnapshot(q, (snap) => {
      const todas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const vigentes = todas.filter(
        (e) => e.pagoHasta && periodoMayorA(e.pagoHasta, periodo),
      );
      setPersonalEntries((prev) => {
        const ids = new Set(prev.map((e) => e.id));
        const nuevas = vigentes.filter((e) => !ids.has(e.id));
        return nuevas.length ? [...prev, ...nuevas] : prev;
      });
    });
  }, [user, periodo]);

  function toggleItem(id) {
    setOpenItems((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function getEntry(expenseId, categoria) {
    const source = categoria === "compartido" ? sharedEntries : personalEntries;
    return source.find((e) => e.fixedExpenseId === expenseId) ?? null;
  }

  function getUserMontoDefault(expenseId) {
    const cfg = userConfig.find((c) => c.expenseId === expenseId);
    return cfg?.montoDefault ?? null;
  }

  function getEstado(expenseId, categoria) {
    const entry = getEntry(expenseId, categoria);
    const montoDefault = categoria === "personal" ? getUserMontoDefault(expenseId) : null;

 if (!entry) {
  return "sin_registrar";
}
    if (entry.pagoHasta && periodoMayorA(entry.pagoHasta, periodo)) return "pagado_hasta";
    if (!entry.paidByUid) return "pendiente_pago";
    if (categoria === "personal") return "saldado";
    const todos = (entry.participantes ?? []).every((p) => p.pagado >= p.corresponde);
    return todos ? "saldado" : "pendiente_saldar";
  }

  // Gastos compartidos — siempre desde taxonomía
  const gastosCompartidos = GASTOS_FIJOS_COMPARTIDOS.map((gasto) => {
    const entry = getEntry(gasto.id, "compartido");
    const estado = getEstado(gasto.id, "compartido");
    const miParticipante = entry?.participantes?.find((p) => p.uid === user?.uid);
    const otroParticipante = entry?.participantes?.find((p) => p.uid !== user?.uid);
    return { ...gasto, entry, estado, miParticipante, otroParticipante };
  });

  // Gastos personales — solo los que el usuario activó en fixed_expenses
  const gastosPersonales = userConfig.map((cfg) => {
    const catalogoItem = GASTOS_FIJOS_PERSONALES_CATALOGO.find((c) => c.id === cfg.expenseId);
    if (!catalogoItem) return null;
    const gasto = {
      ...catalogoItem,
      montoDefault: cfg.montoDefault ?? null,
      configId: cfg.id,
    };
    const entry = getEntry(gasto.id, "personal");
    const estado = getEstado(gasto.id, "personal");
    return { ...gasto, entry, estado };
  }).filter(Boolean);

  // Catálogo disponible para agregar (los que el usuario NO tiene activados aún)
  const activadosIds = new Set(userConfig.map((c) => c.expenseId));
  const catalogoDisponible = GASTOS_FIJOS_PERSONALES_CATALOGO.filter(
    (c) => !activadosIds.has(c.id),
  );

  const balanceNeto = gastosCompartidos.reduce((acc, gasto) => {
    if (!gasto.entry || gasto.estado === "saldado" || gasto.estado === "sin_registrar" || gasto.estado === "pendiente_pago") return acc;
    const miExceso = (gasto.miParticipante?.pagado ?? 0) - (gasto.miParticipante?.corresponde ?? 0);
    return acc + miExceso;
  }, 0);

  const itemsQueDebo = gastosCompartidos.filter((g) => {
    if (g.estado !== "pendiente_saldar") return false;
    return (g.otroParticipante?.pagado ?? 0) >= (g.otroParticipante?.corresponde ?? 0)
      && (g.miParticipante?.pagado ?? 0) < (g.miParticipante?.corresponde ?? 0);
  });

  const itemsQueDebenAMi = gastosCompartidos.filter((g) => {
    if (g.estado !== "pendiente_saldar") return false;
    return (g.miParticipante?.pagado ?? 0) >= (g.miParticipante?.corresponde ?? 0)
      && (g.otroParticipante?.pagado ?? 0) < (g.otroParticipante?.corresponde ?? 0);
  });

  const totalCompartido = gastosCompartidos.reduce((acc, g) => acc + (g.entry?.montoTotal ?? 0), 0);
  const miTotalCompartido = totalCompartido / 2;
  const totalPersonal = gastosPersonales.reduce((acc, g) => acc + (g.entry?.montoTotal ?? 0), 0);

  // ─── ACCIONES ───────────────────────────────────────────

  async function agregarGastoPersonal({ expenseId, montoDefault }) {
    if (!user) return;
    await addDoc(collection(db, "fixed_expenses"), {
      expenseId,
      usuario: user.uid,
      montoDefault: montoDefault ?? null,
      activo: true,
      createdAt: serverTimestamp(),
    });
  }

  async function actualizarMontoDefault({ configId, montoDefault }) {
    if (!configId) return;
    await updateDoc(doc(db, "fixed_expenses", configId), { montoDefault });
  }

  async function desactivarGastoPersonal({ configId }) {
    if (!configId) return;
    await updateDoc(doc(db, "fixed_expenses", configId), { activo: false });
  }

  async function registrarGasto({ expenseId, montoTotal, vencimiento, pagoHasta }) {
    if (!user) return;
    const catalogoItem = GASTOS_FIJOS_PERSONALES_CATALOGO.find((c) => c.id === expenseId)
      ?? GASTOS_FIJOS_COMPARTIDOS_MAP[expenseId];
    if (!catalogoItem) return;

    const esCompartido = !!GASTOS_FIJOS_COMPARTIDOS_MAP[expenseId];
    const montoFinal = montoTotal ?? getUserMontoDefault(expenseId);
    if (!montoFinal) return;

    const existingEntry = esCompartido
      ? sharedEntries.find((e) => e.fixedExpenseId === expenseId)
      : personalEntries.find((e) => e.fixedExpenseId === expenseId);

    const payload = {
      fixedExpenseId: expenseId,
      nombre: catalogoItem.nombre,
      periodo,
      montoTotal: montoFinal,
      vencimiento: vencimiento ?? null,
      pagoHasta: pagoHasta ?? null,
      paidByUid: null,
      paidByNombre: null,
      usuario: user.uid,
      groupId: esCompartido ? grupo?.id ?? null : null,
      participantes: [],
      estado: "pendiente_pago",
      createdAt: serverTimestamp(),
    };

    if (existingEntry) {
      await updateDoc(doc(db, "fixed_expense_entries", existingEntry.id), {
        montoTotal: montoFinal,
        vencimiento: vencimiento ?? null,
        pagoHasta: pagoHasta ?? null,
        estado: "pendiente_pago",
        paidByUid: null,
        paidByNombre: null,
        participantes: [],
      });
    } else {
      await addDoc(collection(db, "fixed_expense_entries"), payload);
    }
  }

  async function registrarPago({ expenseId }) {
    if (!user) return;
    const esCompartido = !!GASTOS_FIJOS_COMPARTIDOS_MAP[expenseId];
    const entry = getEntry(expenseId, esCompartido ? "compartido" : "personal");
    if (!entry) return;

    const nombreUsuario = user.displayName ?? user.email?.split("@")[0] ?? "Usuario";

    if (!esCompartido) {
      await updateDoc(doc(db, "fixed_expense_entries", entry.id), {
        paidByUid: user.uid,
        paidByNombre: nombreUsuario,
        participantes: [{ uid: user.uid, corresponde: entry.montoTotal, pagado: entry.montoTotal }],
        estado: "saldado",
      });
      return;
    }

    const mitad = entry.montoTotal / 2;
    const otroUid = (grupo?.members ?? []).find((uid) => uid !== user.uid) ?? null;
    await updateDoc(doc(db, "fixed_expense_entries", entry.id), {
      paidByUid: user.uid,
      paidByNombre: nombreUsuario,
      participantes: [
        { uid: user.uid, corresponde: mitad, pagado: entry.montoTotal },
        { uid: otroUid, corresponde: mitad, pagado: 0 },
      ],
      estado: "pendiente_saldar",
    });
  }

  async function saldarPendiente({ expenseId }) {
    if (!user) return;
    const entry = sharedEntries.find((e) => e.fixedExpenseId === expenseId);
    if (!entry) return;
    const participantes = entry.participantes.map((p) => ({ ...p, pagado: p.corresponde }));
    await updateDoc(doc(db, "fixed_expense_entries", entry.id), { participantes, estado: "saldado" });
  }

  async function saldarMes() {
    const pendientes = gastosCompartidos.filter((g) => g.estado === "pendiente_saldar" && g.entry);
    for (const gasto of pendientes) {
      const entry = sharedEntries.find((e) => e.fixedExpenseId === gasto.id);
      if (!entry) continue;
      const participantes = entry.participantes.map((p) => ({ ...p, pagado: p.corresponde }));
      await updateDoc(doc(db, "fixed_expense_entries", entry.id), { participantes, estado: "saldado" });
    }
  }

  return {
    loading,
    loadingGroups,
    periodo,
    grupo,
    user,
    gastosCompartidos,
    gastosPersonales,
    catalogoDisponible,
    balanceNeto,
    itemsQueDebo,
    itemsQueDebenAMi,
    totalCompartido,
    totalPersonal,
    openItems,
    toggleItem,
    agregarGastoPersonal,
    actualizarMontoDefault,
    desactivarGastoPersonal,
    registrarGasto,
    registrarPago,
    saldarPendiente,
    saldarMes,
    miTotalCompartido,
  };
}