// balances/components/CajaModal.jsx
// Carga de un monto de caja (5.2, C-3/C-4): ancla de la caja al inicio o caja
// real al cierre. Enteros; se admite el signo negativo (saldo descubierto).

"use client";

import { useState } from "react";

import { MODAL_SHEET_CLASSES } from "@/app/components/ui/modalSheet";
import { formatearMonto } from "../helpers/formato";

function sanitizarMonto(valor) {
  const limpio = valor.replace(/[^\d-]/g, "");
  const negativo = limpio.startsWith("-");
  const digitos = limpio.replace(/-/g, "");

  return `${negativo ? "-" : ""}${digitos}`;
}

export default function CajaModal({
  modo,
  inicial,
  onClose,
  onGuardar,
  guardando,
}) {
  const esInicio = modo === "inicio";
  const [monto, setMonto] = useState(() =>
    inicial !== null && inicial !== undefined ? String(inicial) : "",
  );
  const [error, setError] = useState(null);

  const numero = Number(monto);
  const valido =
    monto !== "" && monto !== "-" && Number.isInteger(numero);

  async function guardar() {
    if (!valido || guardando) return;

    setError(null);

    try {
      await onGuardar(numero);
    } catch (e) {
      setError(
        e?.codigo === "TIMEOUT" || e?.codigo === "PERFIL_FALTANTE"
          ? e.message
          : "No se pudo guardar. Intentá de nuevo.",
      );
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[4px]"
    >
      <div className={MODAL_SHEET_CLASSES} onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 font-sora text-[17px] font-bold text-text">
          {esInicio ? "Caja al inicio" : "Caja real al cierre"}
        </h2>

        <p className="mb-4 rounded-[12px] border border-border bg-white/3 px-4 py-3 text-[11px] leading-[1.5] text-text-muted">
          {esInicio
            ? "Es el ancla del mes: se usa cuando el mes anterior no tiene un cierre real cargado. El arrastre automático tiene prioridad."
            : "Es el único dato manual de cierre del mes. La diferencia contra la caja esperada se muestra, no se ajusta."}
        </p>

        <input
          type="text"
          inputMode="numeric"
          value={monto}
          onChange={(e) => setMonto(sanitizarMonto(e.target.value))}
          placeholder="0"
          className="w-full rounded-[12px] border border-border bg-white/5 px-4 py-3 font-sora text-[22px] font-bold text-text outline-none focus:border-accent2"
        />

        <p className="mt-2 text-[11px] text-text-muted">
          {valido ? formatearMonto(numero) : "Escribí un monto entero."}
        </p>

        {error && (
          <div className="mt-3 rounded-[10px] bg-negative/10 px-[14px] py-[10px] text-[13px] text-negative">
            {error}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-[38%] cursor-pointer rounded-[16px] border border-border py-[12px] text-[14px] font-semibold text-text-muted"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={guardar}
            disabled={!valido || guardando}
            className={`flex-1 rounded-[16px] py-[12px] text-[14px] font-bold text-white transition-all ${
              !valido || guardando
                ? "cursor-default bg-accent/30"
                : "cursor-pointer bg-gradient-to-br from-[#9d7bff] to-[#5b35d5] shadow-[0_8px_28px_rgba(138,100,255,0.38)] hover:scale-[1.01]"
            }`}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
