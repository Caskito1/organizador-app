// reintegros/components/EditarReintegroModal.jsx
// 4.3b — Modal de EDICIÓN de monto (PO-7/DC-2): dos modos —
// «pago» (monto de una entrega, ambas partes) y «obligacion» (monto de la
// obligación, solo registrador; con `devuelto > 0` el campo queda
// deshabilitado con el motivo, D-8(ii)). Patrón idéntico a
// DevolucionModal: dígitos enteros tope 12, precarga del monto actual,
// validación contra el saldo resultante (nuevo devuelto ≤ monto), timeout
// de UI de 15 s SIN reintento (transacción no cancelable; objetivo
// estable pero se evita duplicar la escritura) y anti-doble-toque con
// `enviandoRef`. Usa `editarEntrega` / `editarObligacion` (transacción:
// sin cola, sin retries silenciosos — R-6). MODAL_SHEET_CLASSES (4.3a).

"use client";

import { useEffect, useRef, useState } from "react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";

import { editarEntrega } from
  "@/app/agregar/components/reintegros/helpers/editarEntrega";
import { editarObligacion } from
  "@/app/agregar/components/reintegros/helpers/editarObligacion";
import { ReintegroError } from
  "@/app/agregar/components/reintegros/helpers/submitDevolucion";
import { saldoDe } from "../helpers/modelo";
import { MODAL_SHEET_CLASSES } from "@/app/components/ui/modalSheet";

const TIMEOUT_UI_MS = 15000;
const MAX_MONTO_DIGITOS = 12;

function money(n) {
  return `$${Number(n || 0).toLocaleString("es-AR")}`;
}

function fechaCorta(fecha) {
  const d = fecha?.toDate?.() ?? new Date(fecha);
  return d.toLocaleDateString("es-AR");
}

function mensajeDeError(e) {
  if (e instanceof ReintegroError) {
    if (e.code === "SALDO_INSUFICIENTE") {
      return "El nuevo importe supera el saldo permitido: el saldo cambió; revisá e intentá de nuevo.";
    }
    if (e.code === "MONTO_INVALIDO") {
      return "El monto debe ser un número entero en pesos, mayor a $0.";
    }
    if (e.code === "MONTO_SIN_CAMBIOS") {
      return "El monto es igual al actual: no hay nada que guardar.";
    }
    if (e.code === "MONTO_BLOQUEADO") {
      return "Ya hay pagos registrados: el monto solo se edita con $0 devuelto.";
    }
    if (e.code === "NO_REGISTRADOR") {
      return "Solo quien registró la obligación puede editar su monto.";
    }
    if (e.code === "LIQUIDADA") {
      return "Esta obligación ya está saldada: no admite edición de pagos.";
    }
    if (e.code === "NO_ENCONTRADA") {
      return "Ya no existe: cerrá y revisá la lista.";
    }
    if (e.code === "ELIMINADA") {
      return "Fue eliminada: no admite edición.";
    }
    if (e.code === "CONDONADA") {
      return "Fue condonada: no admite edición.";
    }
    if (e.code === "VALIDACION") {
      return e.message || "Revisá los datos ingresados.";
    }
    return e.message || "No se pudo guardar.";
  }
  // R-6: runTransaction NO encola — sin red no se envía nada.
  if (["unavailable", "deadline-exceeded"].includes(e?.code)) {
    return "No se guardó nada: sin conexión la edición no se envía ni queda en cola. Reintentá cuando tengas conexión.";
  }
  if (e?.code === "permission-denied") {
    return "No se pudo guardar (permisos). Revisá tu sesión e intentá de nuevo.";
  }
  return "No se pudo guardar. Intentá de nuevo.";
}

export default function EditarReintegroModal({ modo, r, entrega, onClose }) {
  const { user } = useAuth();

  const uid = user?.uid ?? null;
  const esPago = modo === "pago";

  const viejo = esPago ? Number(entrega?.monto || 0) : Number(r.monto || 0);
  const devuelto = Number(r.devuelto || 0);
  const montoObl = Number(r.monto || 0);
  const saldo = saldoDe(r);

  // D-8(ii): con pagos registrados el monto de la obligación queda
  // bloqueado (solo el registrador llega hasta acá; el motivo se explica).
  const bloqueadoObligacion = !esPago && devuelto > 0;
  // PO-7/DC-2: lo que este pago puede llegar a sumar sin sobrepasar el monto.
  const disponiblePago = saldo + viejo;

  const [montoDigits, setMontoDigits] = useState(() => String(viejo));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Tras un timeout no hay reintento posible: los campos y el botón quedan
  // bloqueados hasta que el intento en vuelo se resuelva.
  const [timeoutModo, setTimeoutModo] = useState(false);

  const montadoRef = useRef(true);
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  const enVueloRef = useRef(false);
  const enviandoRef = useRef(false);

  function setMonto(valor) {
    setMontoDigits(valor.replace(/\D/g, "").slice(0, MAX_MONTO_DIGITOS));
  }

  const montoDisplay = montoDigits
    ? Number(montoDigits).toLocaleString("es-AR")
    : "";
  const monto = montoDigits ? Number(montoDigits) : 0;

  const sinCambios = monto === viejo;
  const excedeDisponible = esPago && monto > disponiblePago;
  const puedeGuardar =
    !!user &&
    monto > 0 &&
    !sinCambios &&
    !excedeDisponible &&
    !bloqueadoObligacion;

  async function handleGuardar() {
    if (!puedeGuardar || loading || timeoutModo || enviandoRef.current) return;

    enviandoRef.current = true;
    setLoading(true);
    setError(null);
    enVueloRef.current = true;

    const intento = (esPago
      ? editarEntrega({ db, uid, did: entrega.id, monto })
      : editarObligacion({ db, uid, rid: r.id, monto })
    )
      .then(() => "ok")
      .catch((err) => ({ err }));

    let timeoutTimer;
    const timeout = new Promise((resolve) => {
      timeoutTimer = setTimeout(() => resolve("timeout"), TIMEOUT_UI_MS);
    });

    const resultado = await Promise.race([intento, timeout]);
    clearTimeout(timeoutTimer);

    if (resultado === "timeout") {
      setTimeoutModo(true);
      setLoading(false);
      setError(
        "La edición está tardando y no se pudo confirmar. No la reintentés desde acá: revisá la lista antes de guardar de nuevo.",
      );
      intento
        .then(() => {
          enVueloRef.current = false;
          enviandoRef.current = false;
          if (montadoRef.current) onClose();
        })
        .catch((err) => {
          enVueloRef.current = false;
          enviandoRef.current = false;
          console.error("[EditarReintegroModal]", err?.code, err);
          if (montadoRef.current) {
            setError(mensajeDeError(err));
            setTimeoutModo(false);
          }
        });
      return;
    }

    enVueloRef.current = false;
    enviandoRef.current = false;

    if (resultado?.err) {
      const e = resultado.err;
      console.error("[EditarReintegroModal]", e?.code, e);
      setError(mensajeDeError(e));
      setLoading(false);
      return;
    }

    onClose();
  }

  function intentarCerrar() {
    if (loading) return;
    if (timeoutModo && enVueloRef.current) {
      const cerrar = window.confirm(
        "Hay una edición en curso: puede completarse aunque cierres. ¿Cerrar de todos modos?",
      );
      if (!cerrar) return;
    }
    onClose();
  }

  const bloqueado = loading || timeoutModo;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[4px]"
      onClick={intentarCerrar}
    >
      <div
        className={MODAL_SHEET_CLASSES}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-[4px] w-[40px] rounded-full bg-[rgba(255,255,255,0.15)]" />

        <h2 className="mb-1 font-sora text-[17px] font-bold text-text">
          {esPago ? "Editar monto del pago" : "Editar monto"}
        </h2>
        <p className="mb-4 text-[12px] text-text-muted">
          {esPago
            ? "Corregí el importe de este pago."
            : "Corregí el importe de la obligación."}
        </p>

        {/* CONTEXTO */}
        <div className="mb-4 rounded-[14px] border border-border bg-white/3 px-4 py-3">
          <p className="text-[14px] font-medium capitalize text-text">
            {r.concepto}
          </p>
          <p className="mt-[2px] text-[11px] text-text-muted">
            {r.contraparteNombre}
            {esPago &&
              ` · Pago de ${entrega?.realizadoPorNombre || ""} · ${fechaCorta(entrega?.fechaPago)}`}
          </p>
          <p className="mt-[6px] text-[12px] text-text-muted">
            Monto actual:{" "}
            <span className="font-sora font-bold text-text">
              {money(viejo)}
            </span>
            {esPago && (
              <>
                {" · "}
                Saldo de la obligación:{" "}
                <span className="font-sora font-bold text-text">
                  {money(saldo)}
                </span>
              </>
            )}
          </p>
        </div>

        {/* MOTIVO — obligación con pagos: campo bloqueado (D-8(ii)) */}
        {bloqueadoObligacion && (
          <p className="mb-4 rounded-[12px] border border-border bg-white/3 px-4 py-3 text-[11px] leading-[1.5] text-text-muted">
            Ya hay pagos registrados ({money(devuelto)}): el monto solo se
            edita antes del primer pago.
          </p>
        )}

        {/* MONTO — dígitos, tope 12, precargado con el monto actual */}
        <div className="relative mb-1 overflow-hidden rounded-[18px] border border-accent/30 bg-gradient-to-br from-accent/15 to-[#5b35d5]/20 px-[18px] py-4">
          <p className="mb-[6px] text-[11px] font-medium tracking-[0.5px] text-[#c8aeffa6]">
            MONTO ($)
          </p>
          <div className="flex items-center gap-1">
            <span className="font-sora text-[22px] font-bold leading-none text-accent-light">
              $
            </span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={montoDisplay}
              onChange={(e) => setMonto(e.target.value)}
              disabled={bloqueado || bloqueadoObligacion}
              className="w-full border-none bg-transparent p-0 font-sora text-[28px] font-bold tracking-[-1px] text-text outline-none focus:ring-0"
            />
          </div>
        </div>
        {excedeDisponible && (
          <p className="mb-3 text-[11px] text-negative">
            El importe supera lo disponible para este pago ({money(disponiblePago)}).
          </p>
        )}
        {sinCambios && monto > 0 && !bloqueadoObligacion && (
          <p className="mb-3 text-[11px] text-text-muted">
            Sin cambios: el monto es el actual.
          </p>
        )}

        {error && (
          <div className="mt-3 mb-3 rounded-[10px] bg-negative/10 px-[14px] py-[10px] text-[13px] text-negative">
            {error}
          </div>
        )}

        {/* SUBMIT */}
        <button
          type="button"
          onClick={handleGuardar}
          disabled={!puedeGuardar || loading || timeoutModo}
          className={`mt-3 w-full rounded-[16px] py-[14px] text-[15px] font-bold text-white transition-all ${
            !puedeGuardar || loading || timeoutModo
              ? "cursor-default bg-accent/30"
              : "cursor-pointer bg-gradient-to-br from-[#9d7bff] to-[#5b35d5] shadow-[0_8px_28px_rgba(138,100,255,0.38)] hover:scale-[1.01]"
          }`}
        >
          {loading ? "Guardando…" : "Guardar monto"}
        </button>
      </div>
    </div>
  );
}
