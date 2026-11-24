// balances/hooks/useBalances.js
// Hook de la página /balances (5.2): una lectura one-shot (servicio de 5.1 +
// users/{uid}), cadena de saldos y tendencia en memoria, y acciones de
// guardado con timeout de UI. Sin suscripciones (C-11).

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteField } from "firebase/firestore";

import { useAuth } from "@/lib/AuthContext";
import { useGroups } from "@/lib/GroupContext";
import { db } from "@/lib/firebase";

import { calcularBalanceDelMes } from "@/app/balance/helpers/balance";
import { cargarDatosBalance } from "@/app/balance/services/balanceDelMes";

import { BalancesError } from "../helpers/errores";
import {
  MESES_VENTANA,
  construirFilas,
  mesISO,
  metricasTendencia,
  netoInversiones,
  ventanaMeses,
} from "../helpers/cadenaSaldos";
import {
  detalleEgresos,
  detalleIngresos,
  detalleReintegros,
} from "../helpers/detalleMes";
import { guardarMes, leerPreferencias } from "../services/preferencias";

const TIMEOUT_UI_MS = 15000;

const ESTADO_INICIAL = {
  loading: true,
  error: null,
  datos: null,
  prefs: null,
  ahora: null,
};

export default function useBalances(selectedMonth) {
  const { user } = useAuth();
  const { groups, loadingGroups } = useGroups();
  const uid = user?.uid ?? null;

  const [estado, setEstado] = useState(ESTADO_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const enVuelo = useRef(false);

  const cargar = useCallback(async () => {
    if (!uid || loadingGroups || enVuelo.current) return;

    enVuelo.current = true;

    try {
      const [datos, prefs] = await Promise.all([
        cargarDatosBalance({ db, uid, groups }),
        leerPreferencias({ db, uid }),
      ]);

      setEstado({
        loading: false,
        error: null,
        datos,
        prefs,
        ahora: new Date(),
      });
    } catch (error) {
      setEstado((previo) => ({ ...previo, loading: false, error }));
    } finally {
      enVuelo.current = false;
    }
  }, [uid, groups, loadingGroups]);

  useEffect(() => {
    cargar();
  }, [cargar, retryNonce]);

  // C-11: al volver a la pestaña se relee (sin suscripciones).
  useEffect(() => {
    function alVolver() {
      if (document.visibilityState === "visible") cargar();
    }

    document.addEventListener("visibilitychange", alVolver);

    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [cargar]);

  function reintentar() {
    setEstado((previo) => ({ ...previo, loading: true, error: null }));
    setRetryNonce((n) => n + 1);
  }

  const mes = useMemo(
    () => (selectedMonth ? mesISO(selectedMonth) : ""),
    [selectedMonth],
  );

  const filas = useMemo(() => {
    if (!estado.datos || !estado.prefs || !estado.ahora || !uid || !mes) {
      return [];
    }

    const meses = ventanaMeses(mes, MESES_VENTANA);
    const balancesPorMes = {};

    for (const clave of meses) {
      balancesPorMes[clave] = calcularBalanceDelMes({
        mes: clave,
        uid,
        datos: estado.datos,
        ahora: estado.ahora,
        inversiones: netoInversiones(estado.prefs.meses[clave]),
      });
    }

    return construirFilas({
      meses,
      balancesPorMes,
      preferencias: estado.prefs,
      ahora: estado.ahora,
    });
  }, [estado.datos, estado.prefs, estado.ahora, mes, uid]);

  const fila = useMemo(
    () => filas.find((item) => item.mes === mes) ?? null,
    [filas, mes],
  );

  const metricas = useMemo(() => metricasTendencia(filas), [filas]);

  const detalle = useMemo(() => {
    if (!fila) return null;

    return {
      ingresos: detalleIngresos({
        ingresos: estado.datos?.ingresos ?? [],
        rango: fila.balance.rango,
      }),
      egresos: detalleEgresos(fila.balance),
      reintegros: detalleReintegros(fila.balance),
    };
  }, [fila, estado.datos]);

  function aplicarMes(actualizar) {
    setEstado((previo) => {
      if (!previo.prefs) return previo;

      const meses = { ...previo.prefs.meses };
      const actual = { ...(meses[mes] ?? {}) };

      meses[mes] = actualizar(actual);

      return { ...previo, prefs: { ...previo.prefs, meses } };
    });
  }

  async function ejecutarGuardado(cambios) {
    if (!uid) {
      throw new BalancesError("UID_REQUERIDO", "Falta el usuario.");
    }

    if (!estado.prefs?.existe) {
      throw new BalancesError(
        "PERFIL_FALTANTE",
        "Falta tu perfil de usuario: no se pueden guardar datos manuales.",
      );
    }

    setGuardando(true);

    let timer = null;

    try {
      const escritura = guardarMes({
        db,
        uid,
        mes,
        cambios,
        existe: true,
      });
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve("timeout"), TIMEOUT_UI_MS);
      });
      const resultado = await Promise.race([
        escritura.then(() => "ok"),
        timeout,
      ]);

      if (resultado === "timeout") {
        throw new BalancesError(
          "TIMEOUT",
          "No se pudo confirmar el guardado. Revisá antes de reintentar.",
        );
      }
    } finally {
      if (timer) clearTimeout(timer);

      setGuardando(false);
    }
  }

  async function guardarInversiones({ aportes, rescates }) {
    const valor = {
      aportes: Number(aportes) || 0,
      rescates: Number(rescates) || 0,
    };
    const limpiar = valor.aportes === 0 && valor.rescates === 0;

    await ejecutarGuardado(
      limpiar ? { inversiones: deleteField() } : { inversiones: valor },
    );

    aplicarMes((actual) => {
      if (limpiar) {
        delete actual.inversiones;
      } else {
        actual.inversiones = valor;
      }

      return actual;
    });
  }

  async function guardarCajaAlInicio(monto) {
    const valor = Number(monto);

    await ejecutarGuardado({ cajaAlInicio: valor });

    aplicarMes((actual) => ({ ...actual, cajaAlInicio: valor }));
  }

  async function guardarCajaReal(monto) {
    const valor = Number(monto);

    await ejecutarGuardado({ cajaRealAlCierre: valor });

    aplicarMes((actual) => ({ ...actual, cajaRealAlCierre: valor }));
  }

  return {
    loading: estado.loading,
    error: estado.error,
    guardando,
    recargar: reintentar,
    mes,
    fila,
    filas,
    metricas,
    detalle,
    prefsMes: estado.prefs?.meses?.[mes] ?? null,
    existePerfil: Boolean(estado.prefs?.existe),
    esEnCurso: fila?.esEnCurso ?? false,
    guardarInversiones,
    guardarCajaAlInicio,
    guardarCajaReal,
  };
}
