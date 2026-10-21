// reintegros/components/DevolucionModal.jsx
// 4.3a — Modal de PAGO de una obligación (§9.4 de la PROPUESTA Etapa 3).
// «Agregar pago» y «Saldar deuda» abren este modal (modo): el monto se
// precarga con el saldo vigente —en «Saldar deuda» es el saldo exacto—,
// acotado al saldo; fecha `fechaPago` editable (default hoy, se guarda como
// Timestamp local). SIN selector «¿Quién pagó?» (ajuste del usuario
// 21/10/2026): el pagador se DERIVA SIEMPRE del deudor según I-8
// (por_devolver ⇒ yo; por_cobrar ⇒ la otra parte — si es externa, con su
// nombre y sin uid) y se guarda en la entrega igual que antes
// (realizadoPor*); si el deudor derivado es externo se muestra el aviso
// de «otra persona». Usa `submitDevolucion` (transacción: sin cola, sin
// retries silenciosos — R-6) con timeout de UI de 15 s; como la entrega
// NO tiene id estable, tras un timeout NO se permite reintentar desde el
// modal (evita duplicar el pago): se bloquean los campos y el botón, y se
// avisa que hay que revisar la lista.

"use client";

import { useEffect, useRef, useState } from "react";
import { Timestamp } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";

import { submitDevolucion, ReintegroError } from
  "@/app/agregar/components/reintegros/helpers/submitDevolucion";
import { sentidoDelViewer, saldoDe } from "../helpers/modelo";
import { MODAL_SHEET_CLASSES } from "@/app/components/ui/modalSheet";

const TIMEOUT_UI_MS = 15000;
const MAX_MONTO_DIGITOS = 12;

function hoyISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function money(n) {
  return `$${Number(n || 0).toLocaleString("es-AR")}`;
}

// 'YYYY-MM-DD' (input date) → Timestamp a medianoche LOCAL del día elegido.
// Medianoche local evita el corrimiento de mes que tendría un parseo UTC
// en frontera de mes (enRangoMes usa [start, nextStart) sobre toDate()).
function fechaATimestamp(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Timestamp.fromDate(new Date(y, m - 1, d));
}

function mensajeDeError(e) {
  if (e instanceof ReintegroError) {
    if (e.code === "SALDO_INSUFICIENTE") {
      // El formulario ya bloquea monto > saldo conocido: llegar acá implica
      // que el saldo cambió entre la lectura y la escritura (concurrencia).
      return "El saldo cambió; revisá el importe e intentá de nuevo.";
    }
    if (e.code === "MONTO_INVALIDO") {
      return "El monto debe ser un número entero en pesos, mayor a $0.";
    }
    if (e.code === "NO_ENCONTRADA") {
      return "Esta obligación ya no existe. Cerrá y revisá la lista.";
    }
    if (e.code === "ELIMINADA") {
      return "Esta obligación fue eliminada: no admite pagos.";
    }
    if (e.code === "CONDONADA") {
      return "Esta obligación fue condonada: no admite pagos.";
    }
    if (e.code === "VALIDACION") {
      return e.message || "Revisá los datos ingresados.";
    }
    return e.message || "No se pudo guardar.";
  }
  // R-6: runTransaction NO encola — sin red no se envía nada. Mensaje
  // explícito de que no se guardó nada ni quedó en cola (sin retries
  // silenciosos).
  if (["unavailable", "deadline-exceeded"].includes(e?.code)) {
    return "No se guardó nada: sin conexión el pago no se envía ni queda en cola. Reintentá cuando tengas conexión.";
  }
  if (e?.code === "permission-denied") {
    return "No se pudo guardar (permisos). Revisá tu sesión e intentá de nuevo.";
  }
  return "No se pudo guardar. Intentá de nuevo.";
}

export default function DevolucionModal({ r, modo, onClose }) {
  const { user } = useAuth();

  const uid = user?.uid ?? null;
  const uidNombre = user?.displayName || user?.email?.split("@")[0] || "Usuario";
  const saldo = saldoDe(r);
  const esMiembro = !!r.contraparteUid;

  // Sentido de la obligación DESDE EL VIEWER (I-8): por_devolver ⇒ el viewer
  // es el deudor; por_cobrar ⇒ el viewer es acreedor (deudor = la otra
  // parte; si es externa, con su nombre y sin uid).
  const sentidoViewer = sentidoDelViewer(r, uid);

  const [montoDigits, setMontoDigits] = useState(() => String(saldo));
  const [fechaPago, setFechaPago] = useState(hoyISO);
  const [detalle, setDetalle] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Tras un timeout no hay reintento posible (sin id estable de entrega):
  // los campos y el botón quedan bloqueados hasta que el intento en vuelo
  // se resuelva (éxito ⇒ cerrar; fallo ⇒ liberar y poder reintentar).
  const [timeoutModo, setTimeoutModo] = useState(false);

  const montadoRef = useRef(true);
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  // Intento en vuelo tras timeout (no cancelable) — aviso al cerrar.
  const enVueloRef = useRef(false);
  // Guarda síncrona de doble toque: el `disabled` del botón depende del
  // re-render; este ref corta el segundo click en el mismo tick.
  const enviandoRef = useRef(false);

  // «La otra persona» = la cuenta participante que NO es el viewer.
  const otroUid = uid === r.registradoPor ? r.contraparteUid : r.registradoPor;
  const otroNombre = uid === r.registradoPor
    ? r.contraparteNombre
    : r.registradoPorNombre;

  // Pagador derivado SIEMPRE del deudor (I-8, ajuste 21/10/2026 — sin
  // selector): por_devolver ⇒ yo; por_cobrar ⇒ la otra parte (miembro con
  // su uid; externa con su nombre y uid null). Se envía a la entrega igual
  // que antes (realizadoPorUid/realizadoPorNombre — sin cambio de modelo).
  const pagadorEsElViewer = sentidoViewer === "por_devolver";
  const realizadoPor = pagadorEsElViewer
    ? { uid, nombre: uidNombre }
    : esMiembro
      ? { uid: otroUid, nombre: otroNombre }
      : { uid: null, nombre: r.contraparteNombre || "" };

  // Aviso de «otra persona»: solo si el deudor derivado es externo (sin
  // cuenta): su pago no se atribuye por uid a «Devoluciones realizadas».
  const avisoPagadorExterno = !pagadorEsElViewer && !esMiembro;

  function setMonto(valor) {
    setMontoDigits(valor.replace(/\D/g, "").slice(0, MAX_MONTO_DIGITOS));
  }

  const montoDisplay = montoDigits
    ? Number(montoDigits).toLocaleString("es-AR")
    : "";
  const monto = montoDigits ? Number(montoDigits) : 0;

  const excedeSaldo = monto > saldo;
  const puedeGuardar =
    !!user &&
    monto > 0 &&
    !excedeSaldo &&
    !!realizadoPor.nombre &&
    !!fechaPago;

  async function handleGuardar() {
    if (!puedeGuardar || loading || timeoutModo || enviandoRef.current) return;

    enviandoRef.current = true;
    setLoading(true);
    setError(null);
    enVueloRef.current = true;

    const args = {
      db,
      uid,
      uidNombre,
      rid: r.id,
      monto,
      realizadoPorUid: realizadoPor.uid,
      realizadoPorNombre: realizadoPor.nombre,
      fechaPago: fechaATimestamp(fechaPago),
      detalle,
    };

    let timeoutTimer;
    const timeout = new Promise((resolve) => {
      timeoutTimer = setTimeout(() => resolve("timeout"), TIMEOUT_UI_MS);
    });
    const intento = submitDevolucion(args)
      .then(() => "ok")
      .catch((err) => ({ err }));

    const resultado = await Promise.race([intento, timeout]);
    clearTimeout(timeoutTimer);

    if (resultado === "timeout") {
      // Transacción en curso, no cancelable y SIN reintento (una entrega
      // nueva por reintento duplicaría el pago si el primero llega).
      setTimeoutModo(true);
      setLoading(false);
      setError(
        "El pago está tardando y no se pudo confirmar. No lo reintentés desde acá: revisá la lista antes de registrarlo de nuevo.",
      );
      intento
        .then(() => {
          enVueloRef.current = false;
          enviandoRef.current = false;
          // Éxito tardío: la suscripción ya muestra la entrega en la lista.
          if (montadoRef.current) onClose();
        })
        .catch((err) => {
          enVueloRef.current = false;
          enviandoRef.current = false;
          console.error("[DevolucionModal]", err?.code, err);
          // Fallo definitivo: la transacción no escribió nada ⇒ se libera.
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
      console.error("[DevolucionModal]", e?.code, e);
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
        "Hay un pago en curso: puede completarse y quedar registrado aunque cierres. ¿Cerrar de todos modos?",
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
          {modo === "saldar" ? "Saldar deuda" : "Agregar pago"}
        </h2>
        <p className="mb-4 text-[12px] text-text-muted">
          Registrá una devolución sobre esta obligación.
        </p>

        {/* CONTEXTO de la obligación */}
        <div className="mb-4 rounded-[14px] border border-border bg-white/3 px-4 py-3">
          <p className="text-[14px] font-medium capitalize text-text">
            {r.concepto}
          </p>
          <p className="mt-[2px] text-[11px] text-text-muted">
            {r.contraparteNombre}
          </p>
          <p className="mt-[6px] text-[12px] text-text-muted">
            Saldo pendiente:{" "}
            <span className="font-sora font-bold text-text">
              {money(saldo)}
            </span>
          </p>
        </div>

        {/* AVISO — deudor derivado EXTERNO (sin cuenta): el pago no se
            atribuye por uid a «Devoluciones realizadas» (I-8). */}
        {avisoPagadorExterno && (
          <p className="mb-4 text-[11px] leading-[1.5] text-text-muted">
            Este pago lo hizo otra persona: no figura en tus
            «Devoluciones realizadas».
          </p>
        )}

        {/* MONTO — dígitos, tope 12, precargado con el saldo vigente */}
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
              disabled={bloqueado}
              className="w-full border-none bg-transparent p-0 font-sora text-[28px] font-bold tracking-[-1px] text-text outline-none focus:ring-0"
            />
          </div>
        </div>
        {excedeSaldo && (
          <p className="mb-3 text-[11px] text-negative">
            El importe supera el saldo pendiente de {money(saldo)}.
          </p>
        )}

        {/* FECHA DEL PAGO — editable (default hoy; H-5) */}
        <div className="mb-4 mt-3 flex flex-col gap-[6px]">
          <label className="text-[12px] font-medium tracking-[0.3px] text-text-muted">
            FECHA DEL PAGO
          </label>
          <input
            type="date"
            value={fechaPago}
            onChange={(e) => setFechaPago(e.target.value)}
            disabled={bloqueado}
            className="rounded-[14px] border border-border bg-white/3 px-4 py-3 text-[14px] text-text"
          />
        </div>

        {/* DETALLE (opcional) */}
        <div className="mb-4 flex flex-col gap-[6px]">
          <label className="text-[12px] font-medium tracking-[0.3px] text-text-muted">
            DETALLE (opcional)
          </label>
          <input
            type="text"
            placeholder="Información adicional"
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            disabled={bloqueado}
          />
        </div>

        {error && (
          <div className="mb-3 rounded-[10px] bg-negative/10 px-[14px] py-[10px] text-[13px] text-negative">
            {error}
          </div>
        )}

        {/* SUBMIT — deshabilitado mientras corre (doble toque) y tras
            timeout (sin reintento: riesgo de duplicado) */}
        <button
          type="button"
          onClick={handleGuardar}
          disabled={!puedeGuardar || loading || timeoutModo}
          className={`w-full rounded-[16px] py-[14px] text-[15px] font-bold text-white transition-all ${
            !puedeGuardar || loading || timeoutModo
              ? "cursor-default bg-accent/30"
              : "cursor-pointer bg-gradient-to-br from-[#9d7bff] to-[#5b35d5] shadow-[0_8px_28px_rgba(138,100,255,0.38)] hover:scale-[1.01]"
          }`}
        >
          {loading
            ? "Guardando…"
            : modo === "saldar"
              ? "Saldar deuda"
              : "Registrar pago"}
        </button>
      </div>
    </div>
  );
}
