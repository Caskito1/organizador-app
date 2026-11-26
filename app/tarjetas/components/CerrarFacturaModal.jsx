// tarjetas/components/CerrarFacturaModal.jsx
// Consolidar la factura (6.2, §12.8). A-3: el total real de la factura es un
// dato TRANSITORIO para contrastar; NO se persiste (§14.6: sin línea «según el banco»).

"use client";

import { useState } from "react";

import { MODAL_SHEET_CLASSES } from "@/app/components/ui/modalSheet";
import { formatearMonto, formatearUSD } from "@/app/balances/helpers/formato";

function soloDigitos(valor) {
  return valor.replace(/[^\d]/g, "");
}

function signo(n) {
  if (n === null || n === undefined) return "";
  return n > 0 ? `+${formatearMonto(n)}` : formatearMonto(n);
}

export default function CerrarFacturaModal({
  resumen,
  onConfirmar,
  onClose,
  guardando,
}) {
  const [facturaUYU, setFacturaUYU] = useState("");
  const [facturaUSD, setFacturaUSD] = useState("");
  const [error, setError] = useState(null);

  const difUYU = facturaUYU ? Number(facturaUYU) - resumen.total.UYU : null;
  const difUSD = facturaUSD ? Number(facturaUSD) - resumen.total.USD : null;

  async function confirmar() {
    setError(null);
    try {
      await onConfirmar();
      onClose();
    } catch (e) {
      setError(e?.message ?? "No se pudo cerrar la factura.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[4px]"
      onClick={onClose}
    >
      <div className={MODAL_SHEET_CLASSES} onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 font-sora text-[17px] font-bold text-text">
          Cerrar factura
        </h2>
        <p className="mb-4 text-[12px] leading-[1.5] text-text-muted">
          Verificá contra tu factura real antes de cerrar. Después, las compras
          de este ciclo quedan bloqueadas (solo se editan en «sin verificar» y
          cuota 1/n).
        </p>

        <div className="rounded-[12px] bg-white/4 px-4 py-3">
          <p className="flex items-center justify-between text-[12px] text-text-muted">
            <span>Total según compras (UYU)</span>
            <span className="font-sora font-semibold text-text">
              {formatearMonto(resumen.total.UYU)}
            </span>
          </p>
          {resumen.total.USD > 0 && (
            <p className="mt-1 flex items-center justify-between text-[12px] text-text-muted">
              <span>Total según compras (USD)</span>
              <span className="font-sora font-semibold text-text">
                {formatearUSD(resumen.total.USD)}
              </span>
            </p>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
              Total de la factura (UYU) — opcional
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={facturaUYU}
              onChange={(e) => setFacturaUYU(soloDigitos(e.target.value))}
              placeholder="Para contrastar"
              className="w-full rounded-[12px] border border-border bg-white/5 px-4 py-3 font-sora text-[18px] font-bold text-text outline-none focus:border-accent2"
            />
            {difUYU !== null && (
              <span className="text-[10px] text-text-muted">
                Diferencia: {signo(difUYU)}
              </span>
            )}
          </label>

          {resumen.total.USD > 0 && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
                Total de la factura (USD) — opcional
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={facturaUSD}
                onChange={(e) => setFacturaUSD(soloDigitos(e.target.value))}
                placeholder="Para contrastar"
                className="w-full rounded-[12px] border border-border bg-white/5 px-4 py-3 font-sora text-[18px] font-bold text-text outline-none focus:border-accent2"
              />
              {difUSD !== null && (
                <span className="text-[10px] text-text-muted">
                  Diferencia: {signo(difUSD)}
                </span>
              )}
            </label>
          )}
        </div>

        <p className="mt-3 text-[10px] leading-[1.5] text-text-muted">
          Los cargos del banco (2 % + IVA del exterior, seguro) no son compras:
          contemplalos como tolerancia en el contraste.
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
            onClick={confirmar}
            disabled={guardando}
            className={`flex-1 rounded-[16px] py-[12px] text-[14px] font-bold text-white transition-all ${
              guardando
                ? "cursor-default bg-accent/30"
                : "cursor-pointer bg-gradient-to-br from-[#9d7bff] to-[#5b35d5] shadow-[0_8px_28px_rgba(138,100,255,0.38)] hover:scale-[1.01]"
            }`}
          >
            {guardando ? "Cerrando…" : "Cerrar factura"}
          </button>
        </div>
      </div>
    </div>
  );
}
