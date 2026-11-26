// tarjetas/components/PagoModal.jsx
// Pago del resumen (6.2, §12.8). A-1: UN pago por ciclo POR MONEDA, sin
// parciales. A-4: si no cubre el total, el ciclo queda «por pagar».

"use client";

import { useState } from "react";

import { MODAL_SHEET_CLASSES } from "@/app/components/ui/modalSheet";
import { fechaLocal, hoyISO } from "@/app/gastos/helpers/dateHelpers";
import { formatearMonto, formatearUSD } from "@/app/balances/helpers/formato";

function soloDigitos(valor) {
  return valor.replace(/[^\d]/g, "");
}

export default function PagoModal({ aPagar, onGuardar, onClose, guardando }) {
  const [montoUYU, setMontoUYU] = useState(aPagar.UYU > 0 ? String(aPagar.UYU) : "");
  const [montoUSD, setMontoUSD] = useState(aPagar.USD > 0 ? String(aPagar.USD) : "");
  const [fechaISO, setFechaISO] = useState(hoyISO());
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  async function guardar() {
    setError(null);
    setAviso(null);

    const uyu = Number(montoUYU || 0);
    const usd = Number(montoUSD || 0);
    const pagos = {};

    if (uyu > 0) pagos.UYU = { monto: uyu, fecha: fechaLocal(fechaISO) };
    if (usd > 0) pagos.USD = { monto: usd, fecha: fechaLocal(fechaISO) };

    if (!pagos.UYU && !pagos.USD) {
      return setError("Ingresá al menos un monto.");
    }

    try {
      const resultado = await onGuardar(pagos);
      if (resultado?.cubierto === false) {
        setAviso(
          "El pago no cubre el total del resumen: el ciclo queda «por pagar». Ajustá los montos para saldarlo.",
        );
        return;
      }
      onClose();
    } catch (e) {
      setError(e?.message ?? "No se pudo registrar el pago.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[4px]"
      onClick={onClose}
    >
      <div className={MODAL_SHEET_CLASSES} onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 font-sora text-[17px] font-bold text-text">
          Pagar resumen
        </h2>
        <p className="mb-4 text-[12px] leading-[1.5] text-text-muted">
          Un pago por moneda. El pago mueve caja pero no es gasto; la compra no
          se toca.
        </p>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
              Monto UYU
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={montoUYU}
              onChange={(e) => setMontoUYU(soloDigitos(e.target.value))}
              placeholder="0"
              className="w-full rounded-[12px] border border-border bg-white/5 px-4 py-3 font-sora text-[18px] font-bold text-text outline-none focus:border-accent2"
            />
            <span className="text-[10px] text-text-muted">
              A pagar: {formatearMonto(aPagar.UYU)}
            </span>
          </label>

          {aPagar.USD > 0 && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
                Monto USD
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={montoUSD}
                onChange={(e) => setMontoUSD(soloDigitos(e.target.value))}
                placeholder="0"
                className="w-full rounded-[12px] border border-border bg-white/5 px-4 py-3 font-sora text-[18px] font-bold text-text outline-none focus:border-accent2"
              />
              <span className="text-[10px] text-text-muted">
                A pagar: {formatearUSD(aPagar.USD)}
              </span>
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
              Fecha de pago
            </span>
            <input
              type="date"
              value={fechaISO}
              onChange={(e) => setFechaISO(e.target.value)}
              className="w-full rounded-[12px] border border-border bg-white/5 px-4 py-3 text-[14px] text-text outline-none focus:border-accent2"
            />
          </label>
        </div>

        {aviso && (
          <div className="mt-3 rounded-[10px] border border-accent2/30 bg-accent/10 px-[14px] py-[10px] text-[12px] text-accent-light">
            {aviso}
          </div>
        )}

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
            {guardando ? "Guardando…" : "Pagar resumen"}
          </button>
        </div>
      </div>
    </div>
  );
}
