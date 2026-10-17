// reintegros/hooks/useReintegros.js
// Hook de Reintegros: estados derivados, indicadores con sentidoDelViewer,
// entradas/salidas del mes y reconciliación D-7 en runtime (solo dev).

"use client";

import { useEffect, useMemo, useState } from "react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";

import { subscribeReintegros } from "../services/subscribeReintegros";
import {
  sentidoDelViewer,
  saldoDe,
  estadoDe,
  sumaEntregasNoEliminadas,
  assertDevueltoConsistente,
  enRangoMes,
  entradasDelMes,
  salidasDelMes,
} from "../helpers/modelo";

export default function useReintegros(selectedMonth) {
  const { user } = useAuth();

  // loading y error se DERIVAN de dataUid (uid cuyos datos ya llegaron):
  // al cambiar de uid, dataUid != uid → loading=true sin setState síncrono
  // en el effect (patrón react-hooks/set-state-in-effect).
  const [dataUid, setDataUid] = useState(null);
  const [obligaciones, setObligaciones] = useState([]);
  const [devoluciones, setDevoluciones] = useState([]);
  const [errorState, setErrorState] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeReintegros({
      db,
      uid: user.uid,
      onData: ({ obligaciones, devoluciones }) => {
        setDataUid(user.uid);
        setObligaciones(obligaciones);
        setDevoluciones(devoluciones);
        setErrorState(null);
      },
      onError: (e) => {
        setDataUid(user.uid);
        setErrorState(e);
      },
    });

    return () => unsubscribe?.();
  }, [user?.uid]);

  const uid = user?.uid ?? null;
  const loading = !uid || dataUid !== uid;
  const error = dataUid === uid ? errorState : null;

  // Gating: los arrays crudos solo son válidos para el MISMO uid cuyos datos
  // llegaron (dataUid). Al cambiar de usuario, devolvemos vacíos hasta que la
  // nueva suscripción emita — evita filtrar datos viejos con el filtro del
  // usuario nuevo (flicker de datos ajenos). useMemo estabiliza la referencia
  // para no romper las deps de los useMemo aguas abajo.
  const obligacionesGated = useMemo(
    () => (dataUid === uid ? obligaciones : []),
    [dataUid, uid, obligaciones],
  );
  const devolucionesGated = useMemo(
    () => (dataUid === uid ? devoluciones : []),
    [dataUid, uid, devoluciones],
  );

  // Activas: sin eliminación lógica (D-5/P-4: campo ausente = activo).
  const activas = useMemo(
    () => obligacionesGated.filter((r) => !("eliminacion" in r)),
    [obligacionesGated],
  );

  const pendientes = useMemo(
    () =>
      activas.filter((r) => {
        const e = estadoDe(r);
        return e === "pendiente" || e === "parcial";
      }),
    [activas],
  );

  const cerrados = useMemo(
    () =>
      activas.filter((r) => {
        const e = estadoDe(r);
        return e === "liquidado" || e === "condonado";
      }),
    [activas],
  );

  // Stock global de saldos abiertos (PO-1: sin filtro del selector de mes).
  const pendienteCobro = useMemo(
    () =>
      activas
        .filter(
          (r) =>
            !("condonacion" in r) &&
            sentidoDelViewer(r, uid) === "por_cobrar" &&
            saldoDe(r) > 0,
        )
        .reduce((a, r) => a + saldoDe(r), 0),
    [activas, uid],
  );

  const pendienteDevolucion = useMemo(
    () =>
      activas
        .filter(
          (r) =>
            !("condonacion" in r) &&
            sentidoDelViewer(r, uid) === "por_devolver" &&
            saldoDe(r) > 0,
        )
        .reduce((a, r) => a + saldoDe(r), 0),
    [activas, uid],
  );

  // Rango del mes visible SEMIABIERTO: [start, nextStart) — nextStart es el
  // primer día del mes siguiente (cubre el instante exacto de medianoche;
  // el closed-range 23:59:59 lo perdía por redondeo de ms).
  const mes = useMemo(() => {
    if (!selectedMonth) return null;
    const start = new Date(
      selectedMonth.getFullYear(),
      selectedMonth.getMonth(),
      1,
    );
    const nextStart = new Date(
      selectedMonth.getFullYear(),
      selectedMonth.getMonth() + 1,
      1,
    );
    return { start, nextStart };
  }, [selectedMonth]);

  const entregasActivas = useMemo(
    () => devolucionesGated.filter((d) => !("eliminacion" in d)),
    [devolucionesGated],
  );

  // Índices del mes (§6.2): flows por createdAt (obl) y fechaPago (entrega).
  const generadoPorRecuperar = useMemo(() => {
    if (!mes || !uid) return 0;
    return activas
      .filter(
        (r) =>
          sentidoDelViewer(r, uid) === "por_cobrar" &&
          enRangoMes(r.createdAt, mes.start, mes.nextStart),
      )
      .reduce((a, r) => a + Number(r.monto || 0), 0);
  }, [activas, mes, uid]);

  const deudaGenerada = useMemo(() => {
    if (!mes || !uid) return 0;
    return activas
      .filter(
        (r) =>
          sentidoDelViewer(r, uid) === "por_devolver" &&
          enRangoMes(r.createdAt, mes.start, mes.nextStart),
      )
      .reduce((a, r) => a + Number(r.monto || 0), 0);
  }, [activas, mes, uid]);

  const devolucionesRecibidas = useMemo(() => {
    if (!mes || !uid) return 0;
    return entregasActivas
      .filter((d) => {
        const obl = activas.find((r) => r.id === d.reintegroId);
        if (!obl) return false;
        return (
          sentidoDelViewer(obl, uid) === "por_cobrar" &&
          enRangoMes(d.fechaPago, mes.start, mes.nextStart)
        );
      })
      .reduce((a, d) => a + Number(d.monto || 0), 0);
  }, [entregasActivas, activas, mes, uid]);

  const devolucionesRealizadas = useMemo(() => {
    if (!mes || !uid) return 0;
    return entregasActivas
      .filter(
        (d) =>
          d.realizadoPorUid === uid &&
          enRangoMes(d.fechaPago, mes.start, mes.nextStart),
      )
      .reduce((a, d) => a + Number(d.monto || 0), 0);
  }, [entregasActivas, mes, uid]);

  // Entradas/salidas vía funciones puras de modelo.js (I-8: movimientoInicial
  // solo cuenta si registradoPor === uid — la contraparte no lo cuenta).
  const entradasReintegros = useMemo(() => {
    if (!mes || !uid) return 0;
    return entradasDelMes({
      obligaciones: activas,
      entregas: entregasActivas,
      uid,
      start: mes.start,
      nextStart: mes.nextStart,
    });
  }, [activas, entregasActivas, mes, uid]);

  const salidasReintegros = useMemo(() => {
    if (!mes || !uid) return 0;
    return salidasDelMes({
      obligaciones: activas,
      entregas: entregasActivas,
      uid,
      start: mes.start,
      nextStart: mes.nextStart,
    });
  }, [activas, entregasActivas, mes, uid]);

  // D-7 en runtime (solo dev): avisa si devuelto ≠ Σ entregas no eliminadas.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const entregasPorObl = new Map();
    for (const d of entregasActivas) {
      const arr = entregasPorObl.get(d.reintegroId) ?? [];
      arr.push(d);
      entregasPorObl.set(d.reintegroId, arr);
    }
    for (const r of activas) {
      if ("condonacion" in r) continue;
      const entregas = entregasPorObl.get(r.id) ?? [];
      if (!assertDevueltoConsistente(r, entregas)) {
        console.warn(
          `[reintegros] D-7 divergente en ${r.id}: ` +
            `devuelto=${r.devuelto}, ` +
            `Σentregas=${sumaEntregasNoEliminadas(entregas)}`,
        );
      }
    }
  }, [activas, entregasActivas]);

  return {
    loading,
    error,
    obligaciones: obligacionesGated,
    devoluciones: devolucionesGated,
    pendientes,
    cerrados,
    pendienteCobro,
    pendienteDevolucion,
    generadoPorRecuperar,
    deudaGenerada,
    devolucionesRecibidas,
    devolucionesRealizadas,
    entradasReintegros,
    salidasReintegros,
  };
}
