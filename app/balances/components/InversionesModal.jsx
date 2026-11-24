// balances/components/InversionesModal.jsx
// Carga de inversiones del mes (5.2, C-4). Se guardan aportes y rescates
// (enteros >= 0); el neto (rescates - aportes) es lo que recibe 5.1 (A-2).

"use client";

import { useState } from "react";

import { MODAL_SHEET_CLASSES } from "@/app/components/ui/modalSheet";
import { formatearMonto } from "../helpers/formato";

function soloDigitos(valor) {
  return valor.replace(/[^\d]/g, "");
}

export default function InversionesModal({
  inicial,
  onClose,
  onGuardar,
  guardando,
}) {
  const [aportes, setAportes] = useState(() =>
    inicial?.inversiones?.aportes
      ? String(inicial.inversiones.aportes)
      : "",
  );
  const [rescates, setRescates] = useState(() =>
    inicial?.inversiones?.rescates
      ? String(inicial.inversiones.rescates)
      : "",
  );
  const [error, setError] = useState(null);

  const aportesNum = Number(aportes || 0);
  const rescatesNum = Number(rescates || 0);
  const neto = rescatesNum - aportesNum;

  async function guardar() {
    if (guardando) return;

    setError(null);

    try {
      await onGuardar({ aportes: aportesNum, rescates: rescatesNum });
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
          Inversiones del mes
        </h2>

        <p className="mb-4 rounded-[12px] border border-border bg-white/3 px-4 py-3 text-[11px] leading-[1.5] text-text-muted">
          Movimiento entre cuentas, no gasto. Aportes restan; rescates suman.
          El neto no toca el resultado del mes.
        </p>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
              Aportes
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={aportes}
              onChange={(e) => setAportes(soloDigitos(e.target.value))}
              placeholder="0"
              className="w-full rounded-[12px] border border-border bg-white/5 px-4 py-3 font-sora text-[20px] font-bold text-text outline-none focus:border-accent2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
              Rescates
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={rescates}
              onChange={(e) => setRescates(soloDigitos(e.target.value))}
              placeholder="0"
              className="w-full rounded-[12px] border border-border bg-white/5 px-4 py-3 font-sora text-[20px] font-bold text-text outline-none focus:border-accent2"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-[12px] bg-white/4 px-4 py-3">
          <span className="text-[12px] text-text-muted">Neto del mes</span>
          <span className="font-sora text-[18px] font-bold text-accent-light">
            {formatearMonto(neto)}
          </span>
        </div>

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
            disabled={guardando}
            className={`flex-1 rounded-[16px] py-[12px] text-[14px] font-bold text-white transition-all ${
              guardando
                ? "cursor-default bg-accent/30"
                : "cursor-pointer bg-gradient-to-br from-[#9d7bff] to-[#5b35d5] shadow-[0_8px_28px_rgba(138,100,255,0.38)] hover:scale-[1.01]"
            }`}
          >
            {guardando ? "Guardando…" : "Guardar inversiones"}
          </button>
        </div>
      </div>
    </div>
  );
}
