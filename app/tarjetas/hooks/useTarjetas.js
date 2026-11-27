// tarjetas/hooks/useTarjetas.js
// 6.2 — Hook de la página /tarjetas: carga one-shot de users/{uid}.tarjetas,
// derivados del ciclo (6.0) y acciones contra los servicios 6.1.
// Plan: PROPUESTA-ETAPA-6.md §12.12.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";

import { cicloDeFecha, etiquetaCiclo } from "../helpers/ciclo";
import { esCompraEditable } from "../helpers/edicion";
import { estadoCiclo } from "../helpers/estados";
import { pagoCubreCiclo } from "../helpers/pagos";
import { cicloPendiente, ciclosConDatos } from "../helpers/pendiente";
import { claveDeMes, rotuloRango, rotuloVencimiento } from "../helpers/fechas";
import { TarjetasError } from "../helpers/persistencia";
import { comprasDelCiclo, resumenCiclo } from "../helpers/resumen";
import {
  agregarCompra,
  eliminarCompra,
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

  // 6.2-bis: factura pendiente (ciclo pasado con datos y sin pagar). Bloquea
  // las escrituras de los ciclos posteriores hasta que se resuelva.
  const pendiente = useMemo(
    () =>
      cicloPendiente({
        compras: tarjeta?.compras ?? [],
        apertura: tarjeta?.apertura ?? [],
        ciclos: tarjeta?.ciclos ?? {},
        cicloActual,
        diaCierre,
        diaVencimiento,
      }),
    [tarjeta, cicloActual, diaCierre, diaVencimiento],
  );

  // Primer ciclo por defecto: el pendiente más viejo si existe; si no, el
  // CICLO actual (no el mes calendario).
  useEffect(() => {
    if (estado.loading || cicloKey) return;
    setCicloKey(pendiente ?? cicloActual);
  }, [estado.loading, cicloActual, pendiente, cicloKey]);

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
      comprasDelCiclo({
        compras: tarjeta?.compras ?? [],
        cicloKey: cicloSel,
        diaCierre,
        diaVencimiento,
      }),
    [tarjeta, cicloSel, diaCierre, diaVencimiento],
  );

  // 6.2-bis: CTAs y bloqueo del ciclo seleccionado.
  const bloqueado = !!pendiente && !!cicloSel && cicloSel > pendiente;
  const esCicloPendiente = !!pendiente && cicloSel === pendiente;
  const tieneDatos = useMemo(
    () =>
      ciclosConDatos({
        compras: tarjeta?.compras ?? [],
        apertura: tarjeta?.apertura ?? [],
        diaCierre,
        diaVencimiento,
      }).has(cicloSel),
    [tarjeta, cicloSel, diaCierre, diaVencimiento],
  );
  const puedeCargarCompra = cicloSel === cicloActual && !pendiente;
  const puedeCerrarFactura =
    estadoDelCiclo === "sin_verificar" &&
    tieneDatos &&
    ((cicloSel === cicloActual && !pendiente) || esCicloPendiente);
  const puedePagarResumen = estadoDelCiclo === "por_pagar" && !bloqueado;

  function errorBloqueo() {
    return new TarjetasError(
      "CICLO_BLOQUEADO",
      `Hay una factura pendiente (${etiquetaCiclo(pendiente) ?? pendiente}) sin cerrar o sin pagar. Resolvela antes de operar ciclos posteriores.`,
    );
  }

  async function ejecutar(accion) {
    setGuardando(true);
    try {
      return await conTimeout(accion());
    } finally {
      setGuardando(false);
    }
  }

  async function guardarConfig(config) {
    if (pendiente) throw errorBloqueo();

    await ejecutar(() =>
      guardarTarjeta({ db, uid, tarjetaId: TARJETA_ID, config }),
    );
    setCicloKey(null);
    await cargar({ silencioso: true });
  }

  async function crearCompra(compra) {
    if (pendiente) throw errorBloqueo();

    await ejecutar(() =>
      agregarCompra({ db, uid, tarjetaId: TARJETA_ID, compra }),
    );
    await cargar({ silencioso: true });
  }

  async function actualizarCompra(compraId, cambios) {
    if (bloqueado) throw errorBloqueo();

    await ejecutar(() =>
      editarCompra({ db, uid, tarjetaId: TARJETA_ID, compraId, cambios }),
    );
    await cargar({ silencioso: true });
  }

  async function borrarCompra(compraId) {
    if (bloqueado) throw errorBloqueo();

    await ejecutar(() =>
      eliminarCompra({ db, uid, tarjetaId: TARJETA_ID, compraId }),
    );
    await cargar({ silencioso: true });
  }

  async function cerrarFactura() {
    if (bloqueado) throw errorBloqueo();

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
    if (bloqueado) throw errorBloqueo();

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
    ciclos: tarjeta?.ciclos ?? {},
    pagosCiclo: tarjeta?.pagos?.[cicloSel] ?? {},
    diaCierre,
    diaVencimiento,
    vencimientoLabel: rotuloVencimiento(cicloSel, diaVencimiento),
    rangoLabel: rotuloRango(cicloSel, diaCierre, diaVencimiento),
    pendiente,
    bloqueado,
    puedeCargarCompra,
    puedeCerrarFactura,
    puedePagarResumen,
    esCicloPendiente,
    esCompraEditable: (compra) =>
      !bloqueado &&
      esCompraEditable(compra, {
        cicloKey: cicloSel,
        cicloActual,
        estado: estadoDelCiclo,
        diaCierre,
        diaVencimiento,
      }),
    acciones: {
      guardarConfig,
      crearCompra,
      actualizarCompra,
      borrarCompra,
      cerrarFactura,
      pagarResumen,
    },
  };
}
