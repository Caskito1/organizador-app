// tarjetas/hooks/useTarjetas.js
// 6.2 — Hook de la página /tarjetas: carga one-shot de users/{uid}.tarjetas,
// derivados del ciclo (6.0) y acciones contra los servicios 6.1.
// Plan: PROPUESTA-ETAPA-6.md §12.12.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { aDate } from "@/app/gastos/helpers/dateHelpers";

import { cuotaAperturaEnCiclo } from "../helpers/apertura";
import { cicloDeFecha } from "../helpers/ciclo";
import { cuotaEnCiclo } from "../helpers/cuota";
import { esAperturaEditable, esCompraEditable } from "../helpers/edicion";
import { estadoCiclo } from "../helpers/estados";
import { pagoCubreCiclo } from "../helpers/pagos";
import { claveDeMes, rotuloRango, rotuloVencimiento } from "../helpers/fechas";
import { TarjetasError } from "../helpers/persistencia";
import { resumenCiclo } from "../helpers/resumen";
import {
  agregarApertura,
  agregarCompra,
  eliminarApertura,
  eliminarCompra,
  editarApertura,
  editarCompra,
  guardarEstadoCiclo,
  guardarPago,
  guardarTarjeta,
  leerTarjetas,
} from "../services/tarjetas";

const TARJETA_ID = "oca";
const DEFAULT_CIERRE = 18;
const DEFAULT_VENC = 30;
const TIMEOUT_UI_MS = 15000;

const ESTADO_INICIAL = {
  loading: true,
  error: null,
  existe: false,
  tarjetas: {},
  ahora: null,
};

function conTimeout(promesa) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new TarjetasError(
            "TIMEOUT",
            "La operación está tardando y no se pudo confirmar. Revisá antes de reintentar.",
          ),
        ),
      TIMEOUT_UI_MS,
    );

    promesa.then(
      (valor) => {
        clearTimeout(timer);
        resolve(valor);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export default function useTarjetas() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [estado, setEstado] = useState(ESTADO_INICIAL);
  const [cicloKey, setCicloKey] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(
    async ({ silencioso = false } = {}) => {
      if (!uid) return;

      if (!silencioso) {
        setEstado((previo) => ({ ...previo, loading: true, error: null }));
      }

      try {
        const r = await leerTarjetas({ db, uid });
        setEstado({
          loading: false,
          error: null,
          existe: r.existe,
          tarjetas: r.tarjetas,
          ahora: new Date(),
        });
      } catch (error) {
        setEstado((previo) => ({ ...previo, loading: false, error }));
      }
    },
    [uid],
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    function alVolver() {
      if (document.visibilityState === "visible") cargar({ silencioso: true });
    }

    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [cargar]);

  const tarjeta = estado.tarjetas[TARJETA_ID] ?? null;
  const diaCierre = tarjeta?.diaCierre ?? DEFAULT_CIERRE;
  const diaVencimiento = tarjeta?.diaVencimiento ?? DEFAULT_VENC;
  const ahora = estado.ahora ?? new Date();
  const cicloActual = cicloDeFecha(ahora, diaCierre, diaVencimiento);
  const cicloSel = cicloKey ?? cicloActual;

  // Primer ciclo por defecto: el CICLO actual (no el mes calendario).
  useEffect(() => {
    if (estado.loading || cicloKey) return;
    setCicloKey(cicloDeFecha(estado.ahora ?? new Date(), diaCierre, diaVencimiento));
  }, [estado.loading, estado.ahora, diaCierre, diaVencimiento, cicloKey]);

  const resumen = useMemo(
    () =>
      resumenCiclo({
        compras: tarjeta?.compras ?? [],
        apertura: tarjeta?.apertura ?? [],
        cicloKey: cicloSel,
        diaCierre,
        diaVencimiento,
      }),
    [tarjeta, cicloSel, diaCierre, diaVencimiento],
  );

  const estadoDelCiclo = estadoCiclo(tarjeta?.ciclos ?? {}, cicloSel);

  const comprasCiclo = useMemo(
    () =>
      (tarjeta?.compras ?? [])
        .map((compra) => ({
          compra,
          cuota: cuotaEnCiclo(compra, cicloSel, diaCierre, diaVencimiento),
        }))
        .filter((item) => item.cuota)
        .sort(
          (a, b) =>
            (aDate(a.compra.fecha)?.getTime() ?? 0) -
            (aDate(b.compra.fecha)?.getTime() ?? 0),
        ),
    [tarjeta, cicloSel, diaCierre, diaVencimiento],
  );

  const apertura = useMemo(
    () =>
      (tarjeta?.apertura ?? []).map((plan) => ({
        plan,
        cuota: cuotaAperturaEnCiclo(plan, cicloSel),
      })),
    [tarjeta, cicloSel],
  );

  async function ejecutar(accion) {
    setGuardando(true);
    try {
      return await conTimeout(accion());
    } finally {
      setGuardando(false);
    }
  }

  async function guardarConfig(config) {
    await ejecutar(() =>
      guardarTarjeta({ db, uid, tarjetaId: TARJETA_ID, config }),
    );
    setCicloKey(null);
    await cargar({ silencioso: true });
  }

  async function crearCompra(compra) {
    await ejecutar(() =>
      agregarCompra({ db, uid, tarjetaId: TARJETA_ID, compra }),
    );
    await cargar({ silencioso: true });
  }

  async function actualizarCompra(compraId, cambios) {
    await ejecutar(() =>
      editarCompra({ db, uid, tarjetaId: TARJETA_ID, compraId, cambios }),
    );
    await cargar({ silencioso: true });
  }

  async function borrarCompra(compraId) {
    await ejecutar(() =>
      eliminarCompra({ db, uid, tarjetaId: TARJETA_ID, compraId }),
    );
    await cargar({ silencioso: true });
  }

  async function cerrarFactura() {
    await ejecutar(() =>
      guardarEstadoCiclo({
        db,
        uid,
        tarjetaId: TARJETA_ID,
        cicloKey: cicloSel,
        estado: "por_pagar",
      }),
    );
    await cargar({ silencioso: true });
  }

  async function pagarResumen(pagos) {
    const resultado = await ejecutar(async () => {
      const registrados = { ...(tarjeta?.pagos?.[cicloSel] ?? {}) };

      for (const moneda of ["UYU", "USD"]) {
        const pago = pagos?.[moneda];
        if (!pago || !(Number(pago.monto) > 0)) continue;

        await guardarPago({
          db,
          uid,
          tarjetaId: TARJETA_ID,
          cicloKey: cicloSel,
          moneda,
          pago,
        });
        registrados[moneda] = pago;
      }

      const cubierto = pagoCubreCiclo(
        { [cicloSel]: registrados },
        cicloSel,
        resumen.total,
      );

      await guardarEstadoCiclo({
        db,
        uid,
        tarjetaId: TARJETA_ID,
        cicloKey: cicloSel,
        estado: cubierto ? "pagada" : "por_pagar",
      });

      return { cubierto };
    });

    await cargar({ silencioso: true });
    return resultado;
  }

  async function crearApertura(plan) {
    await ejecutar(() =>
      agregarApertura({ db, uid, tarjetaId: TARJETA_ID, plan }),
    );
    await cargar({ silencioso: true });
  }

  async function actualizarApertura(planId, cambios) {
    await ejecutar(() =>
      editarApertura({ db, uid, tarjetaId: TARJETA_ID, planId, cambios }),
    );
    await cargar({ silencioso: true });
  }

  async function borrarApertura(planId) {
    await ejecutar(() =>
      eliminarApertura({ db, uid, tarjetaId: TARJETA_ID, planId }),
    );
    await cargar({ silencioso: true });
  }

  function seleccionarCiclo(fecha) {
    setCicloKey(claveDeMes(fecha));
  }

  return {
    loading: estado.loading,
    error: estado.error,
    existe: estado.existe,
    tarjeta,
    guardando,
    recargar: () => cargar(),
    cicloKey: cicloSel,
    cicloActual,
    seleccionarCiclo,
    estado: estadoDelCiclo,
    resumen,
    comprasCiclo,
    apertura,
    ciclos: tarjeta?.ciclos ?? {},
    pagosCiclo: tarjeta?.pagos?.[cicloSel] ?? {},
    diaCierre,
    diaVencimiento,
    vencimientoLabel: rotuloVencimiento(cicloSel, diaVencimiento),
    rangoLabel: rotuloRango(cicloSel, diaCierre, diaVencimiento),
    esCompraEditable: (compra) =>
      esCompraEditable(compra, {
        cicloKey: cicloSel,
        estado: estadoDelCiclo,
        diaCierre,
        diaVencimiento,
      }),
    esAperturaEditable: (plan) =>
      esAperturaEditable(plan, { ciclos: tarjeta?.ciclos ?? {} }),
    acciones: {
      guardarConfig,
      crearCompra,
      actualizarCompra,
      borrarCompra,
      cerrarFactura,
      pagarResumen,
      crearApertura,
      actualizarApertura,
      borrarApertura,
    },
  };
}
