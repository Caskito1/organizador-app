// tarjetas/components/CompraModal.jsx
// Alta/edición de una compra (6.2, §12.6). El tipo «Reintegro» queda
// deshabilitado hasta 6.3 (A-2).

"use client";

import { useState } from "react";

import { MODAL_SHEET_CLASSES } from "@/app/components/ui/modalSheet";
import { fechaLocal, hoyISO, isoDeFecha } from "@/app/gastos/helpers/dateHelpers";

function soloDigitos(valor) {
  return valor.replace(/[^\d]/g, "");
}

export default function CompraModal({ inicial, onGuardar, onClose, guardando }) {
  const [fechaISO, setFechaISO] = useState(() =>
    inicial ? isoDeFecha(inicial.fecha) : hoyISO(),
  );
  const [detalle, setDetalle] = useState(inicial?.detalle ?? "");
  const [monto, setMonto] = useState(inicial?.monto ? String(inicial.monto) : "");
  const [moneda, setMoneda] = useState(inicial?.moneda ?? "UYU");
  const [cuotas, setCuotas] = useState(
    inicial?.cuotasTotal ? String(inicial.cuotasTotal) : "1",
  );
  const [error, setError] = useState(null);

  async function guardar() {
    setError(null);

    const montoNum = Number(monto || 0);
    const cuotasNum = Number(cuotas || 0);

    if (!fechaISO) return setError("Elegí una fecha.");
    if (!Number.isInteger(montoNum) || montoNum <= 0) {
      return setError("El monto debe ser un entero mayor a 0 (sin centavos).");
    }
    if (!Number.isInteger(cuotasNum) || cuotasNum < 1) {
      return setError("Las cuotas deben ser un entero mayor o igual a 1.");
    }

    try {
      await onGuardar({
        fecha: fechaLocal(fechaISO),
        detalle: detalle.trim(),
        monto: montoNum,
        moneda,
        cuotasTotal: cuotasNum,
        tipo: "personal",
      });
      onClose();
    } catch (e) {
      setError(e?.message ?? "No se pudo guardar la compra.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[4px]"
      onClick={onClose}
    >
      <div className={MODAL_SHEET_CLASSES} onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 font-sora text-[17px] font-bold text-text">
          {inicial ? "Editar compra" : "Cargar compra"}
        </h2>
        <p className="mb-4 text-[12px] text-text-muted">
          La compra no afecta el resultado: vive en el detalle de la tarjeta. Las
          cuotas se pagan con el resumen de cada ciclo.
        </p>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
              Fecha
            </span>
            <input
              type="date"
              value={fechaISO}
              onChange={(e) => setFechaISO(e.target.value)}
              className="w-full rounded-[12px] border border-border bg-white/5 px-4 py-3 text-[14px] text-text outline-none focus:border-accent2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
              Detalle
            </span>
            <input
              type="text"
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              placeholder="Heladera, pasajes…"
              maxLength={80}
              className="w-full rounded-[12px] border border-border bg-white/5 px-4 py-3 text-[14px] text-text outline-none focus:border-accent2"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
                Monto
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={monto}
                onChange={(e) => setMonto(soloDigitos(e.target.value))}
                placeholder="0"
                className="w-full rounded-[12px] border border-border bg-white/5 px-4 py-3 font-sora text-[18px] font-bold text-text outline-none focus:border-accent2"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
                Cuotas
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={cuotas}
                onChange={(e) => setCuotas(soloDigitos(e.target.value))}
                placeholder="1"
                className="w-full rounded-[12px] border border-border bg-white/5 px-4 py-3 font-sora text-[18px] font-bold text-text outline-none focus:border-accent2"
              />
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
              Moneda
            </span>
            <div className="flex gap-2">
              {["UYU", "USD"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMoneda(m)}
                  className={`flex-1 cursor-pointer rounded-[12px] border py-[10px] text-[13px] font-semibold transition-all ${
                    moneda === m
                      ? "border-accent2 bg-accent/20 text-text"
                      : "border-border bg-white/4 text-text-muted"
                  }`}
                >
                  {m === "USD" ? "US$ (USD)" : "$ (UYU)"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
              Tipo
            </span>
            <div className="flex gap-2">
              <span className="flex-1 rounded-[12px] border border-accent2 bg-accent/20 py-[10px] text-center text-[13px] font-semibold text-text">
                Personal
              </span>
              <span
                title="Disponible en 6.3"
                className="flex-1 rounded-[12px] border border-border bg-white/3 py-[10px] text-center text-[13px] font-semibold text-text-muted/50"
              >
                Reintegro
              </span>
            </div>
          </div>
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
            {guardando ? "Guardando…" : inicial ? "Guardar cambios" : "Cargar compra"}
          </button>
        </div>
      </div>
    </div>
  );
}
