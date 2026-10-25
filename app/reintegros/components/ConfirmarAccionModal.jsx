// reintegros/components/ConfirmarAccionModal.jsx
// 4.3-bis — Mini-modal de confirmación para las tres acciones: «condonar»
// (Perdonar deuda), «eliminar-obligacion» y «eliminar-pago». Patrón idéntico
// a EditarReintegroModal (4.3b): MODAL_SHEET_CLASSES, timeout de UI de 15 s
// SIN reintento (transacción no cancelable — R-6), anti-doble-toque con
// `enviandoRef`, motivo OPCIONAL y mensajes de UI para cada código de error
// de los tres helpers. D-9 opción B (copy para condonadas) quedó RETIRADA
// el 24/10/2026: en Cerradas no hay menú ni eliminación. NO toca
// DevolucionModal ni useReintegros.

"use client";

import { useEffect, useRef, useState } from "react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";

import { eliminarEntrega } from
  "@/app/agregar/components/reintegros/helpers/eliminarEntrega";
import { eliminarObligacion } from
  "@/app/agregar/components/reintegros/helpers/eliminarObligacion";
import { condonar } from
  "@/app/agregar/components/reintegros/helpers/condonar";
import { ReintegroError } from
  "@/app/agregar/components/reintegros/helpers/submitDevolucion";
import { saldoDe } from "../helpers/modelo";
import { MODAL_SHEET_CLASSES } from "@/app/components/ui/modalSheet";

const TIMEOUT_UI_MS = 15000;

const UI = {
  condonar: {
    titulo: "Perdonar deuda",
    desc: "La deuda pendiente quedará perdonada: no es un pago, no modifica lo ya recibido y los pagos existentes quedan congelados.",
    boton: "Perdonar deuda",
    enviando: "Perdonando…",
  },
  "eliminar-obligacion": {
    titulo: "Eliminar obligación",
    desc: "Se quitará esta obligación de tus listas. Sus pagos quedan conservados como historial y dejan de contar en tu dinero del mes.",
    boton: "Eliminar",
    enviando: "Eliminando…",
  },
  "eliminar-pago": {
    titulo: "Eliminar pago",
    desc: "Se quitará este pago y el saldo de la obligación se recalculará.",
    boton: "Eliminar",
    enviando: "Eliminando…",
  },
};

function money(n) {
  return `$${Number(n || 0).toLocaleString("es-AR")}`;
}

function fechaCorta(fecha) {
  const d = fecha?.toDate?.() ?? new Date(fecha);
  return d.toLocaleDateString("es-AR");
}

function mensajeDeError(e) {
  if (e instanceof ReintegroError) {
    if (e.code === "NO_ENCONTRADA") {
      return "Ya no existe: cerrá y revisá la lista.";
    }
    if (e.code === "ELIMINADA") {
      return "Ya fue eliminada: no se repite la acción.";
    }
    if (e.code === "CONDONADA") {
      return "Esta deuda ya fue perdonada.";
    }
    if (e.code === "LIQUIDADA") {
      return "Esta obligación ya está saldada: la acción aplica solo sobre deudas abiertas.";
    }
    if (e.code === "NO_REGISTRADOR") {
      return "Solo quien registró la obligación puede eliminarla.";
    }
    if (e.code === "NO_ACREEDOR") {
      return "Solo quien tiene que cobrar esta deuda puede perdonarla.";
    }
    if (e.code === "VALIDACION") {
      return e.message || "Revisá los datos ingresados.";
    }
    return e.message || "No se pudo completar.";
  }
  // R-6: runTransaction NO encola — sin red no se envía nada.
  if (["unavailable", "deadline-exceeded"].includes(e?.code)) {
    return "No se guardó nada: sin conexión la acción no se envía ni queda en cola. Reintentá cuando tengas conexión.";
  }
  if (e?.code === "permission-denied") {
    return "No se pudo completar (permisos). Revisá tu sesión e intentá de nuevo.";
  }
  return "No se pudo completar. Intentá de nuevo.";
}

export default function ConfirmarAccionModal({ tipo, r, entrega, onClose }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const ui = UI[tipo];
  const esPago = tipo === "eliminar-pago";
  const esAccionPeligrosa = tipo !== "condonar";

  const monto = Number(r.monto || 0);
  const devuelto = Number(r.devuelto || 0);
  const saldo = saldoDe(r);

  const [motivo, setMotivo] = useState("");
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

  async function handleConfirmar() {
    if (loading || timeoutModo || enviandoRef.current || !user) return;

    enviandoRef.current = true;
    setLoading(true);
    setError(null);
    enVueloRef.current = true;

    const motivoLimpio = motivo.trim() || null;

    const intento = (
      tipo === "condonar"
        ? condonar({ db, uid, rid: r.id, motivo: motivoLimpio })
        : tipo === "eliminar-obligacion"
          ? eliminarObligacion({ db, uid, rid: r.id, motivo: motivoLimpio })
          : eliminarEntrega({ db, uid, did: entrega.id, motivo: motivoLimpio })
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
        "La operación está tardando y no se pudo confirmar. No la reintentés desde acá: revisá la lista antes de repetir.",
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
          console.error("[ConfirmarAccionModal]", err?.code, err);
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
      console.error("[ConfirmarAccionModal]", e?.code, e);
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
        "Hay una operación en curso: puede completarse aunque cierres. ¿Cerrar de todos modos?",
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
          {ui.titulo}
        </h2>
        <p className="mb-4 text-[12px] leading-[1.55] text-text-muted">
          {ui.desc}
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
            {esPago ? (
              <>
                Monto del pago:{" "}
                <span className="font-sora font-bold text-text">
                  {money(entrega?.monto)}
                </span>
                {" · "}
                Saldo de la obligación:{" "}
                <span className="font-sora font-bold text-text">
                  {money(saldo)}
                </span>
              </>
            ) : tipo === "condonar" ? (
              <>
                Deuda pendiente:{" "}
                <span className="font-sora font-bold text-text">
                  {money(saldo)}
                </span>
              </>
            ) : (
              <>
                Monto {money(monto)} · Saldado {money(devuelto)} · Pendiente{" "}
                <span className="font-sora font-bold text-text">
                  {money(saldo)}
                </span>
              </>
            )}
          </p>
        </div>

        {/* MOTIVO — opcional en las tres acciones (DC-6/DC-7/DC-8) */}
        <div className="mb-1">
          <label
            htmlFor="motivo-accion"
            className="mb-[6px] block text-[11px] font-medium tracking-[0.5px] text-[#c8aeffa6]"
          >
            MOTIVO (OPCIONAL)
          </label>
          <input
            id="motivo-accion"
            type="text"
            placeholder="Carga errónea, acuerdo entre las partes…"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={bloqueado}
            maxLength={200}
            className="w-full rounded-[14px] border border-accent/30 bg-white/4 px-4 py-[11px] text-[13px] text-text outline-none transition-colors placeholder:text-text-muted focus:border-accent/60"
          />
        </div>

        {error && (
          <div className="mt-3 mb-3 rounded-[10px] bg-negative/10 px-[14px] py-[10px] text-[13px] text-negative">
            {error}
          </div>
        )}

        {/* SUBMIT */}
        <button
          type="button"
          onClick={handleConfirmar}
          disabled={bloqueado || !user}
          className={`mt-3 w-full rounded-[16px] py-[14px] text-[15px] font-bold text-white transition-all ${
            bloqueado || !user
              ? "cursor-default bg-accent/30"
              : esAccionPeligrosa
                ? "cursor-pointer bg-gradient-to-br from-[#ff5f6d] to-[#c62f43] shadow-[0_8px_28px_rgba(214,63,67,0.32)] hover:scale-[1.01]"
                : "cursor-pointer bg-gradient-to-br from-[#9d7bff] to-[#5b35d5] shadow-[0_8px_28px_rgba(138,100,255,0.38)] hover:scale-[1.01]"
          }`}
        >
          {loading ? ui.enviando : ui.boton}
        </button>

        <button
          type="button"
          onClick={intentarCerrar}
          disabled={loading}
          className="mt-2 w-full rounded-[16px] border border-border bg-white/3 py-[12px] text-[14px] font-semibold text-text-muted transition-all hover:bg-white/8 hover:text-text"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
