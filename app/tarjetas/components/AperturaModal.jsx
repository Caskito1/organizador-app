// tarjetas/components/AperturaModal.jsx
// Alta/edición de un plan de apertura (6.2, §12.9).

"use client";

import { useState } from "react";

import { MODAL_SHEET_CLASSES } from "@/app/components/ui/modalSheet";

function soloDigitos(valor) {
  return valor.replace(/[^\d]/g, "");
}

const CICLO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export default function AperturaModal({
  inicial,
  cicloActual,
  onGuardar,
  onClose,
  guardando,
}) {
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [moneda, setMoneda] = useState(inicial?.moneda ?? "UYU");
  const [montoCuota, setMontoCuota] = useState(
    inicial?.montoCuota ? String(inicial.montoCuota) : "",
  );
  const [cuotas, setCuotas] = useState(
    inicial?.cuotasTotal ? String(inicial.cuotasTotal) : "12",
  );
  const [desdeCiclo, setDesdeCiclo] = useState(
    inicial?.desdeCiclo ?? cicloActual ?? "",
  );
  const [error, setError] = useState(null);

  async function guardar() {
    setError(null);

    const monto = Number(montoCuota || 0);
    const cuotasNum = Number(cuotas || 0);

    if (!descripcion.trim()) return setError("La descripción es obligatoria.");
    if (!Number.isInteger(monto) || monto <= 0) {
      return setError("La cuota debe ser un entero mayor a 0.");
    }
    if (!Number.isInteger(cuotasNum) || cuotasNum < 1) {
      return setError("Las cuotas deben ser un entero mayor o igual a 1.");
    }
    if (!CICLO_RE.test(desdeCiclo)) {
      return setError("El ciclo de inicio debe ser un mes (YYYY-MM).");
    }

    try {
      await onGuardar({
        descripcion: descripcion.trim(),
        moneda,
        montoCuota: monto,
        cuotasTotal: cuotasNum,
        desdeCiclo,
      });
      onClose();
    } catch (e) {
      setError(e?.message ?? "No se pudo guardar el plan.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[4px]"
      onClick={onClose}
    >
      <div className={MODAL_SHEET_CLASSES} onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 font-sora text-[17px] font-bold text-text">
          {inicial ? "Editar plan de apertura" : "Agregar plan de apertura"}
        </h2>
        <p className="mb-4 text-[12px] text-text-muted">
          Deuda que ya venía en cuotas al momento de empezar a usar la tarjeta.
          Aparece en el ciclo y en la deuda; no toca el resultado.
        </p>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
              Descripción
            </span>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Peñarol, opencodeGo…"
              maxLength={60}
              className="w-full rounded-[12px] border border-border bg-white/5 px-4 py-3 text-[14px] text-text outline-none focus:border-accent2"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
                Cuota
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={montoCuota}
                onChange={(e) => setMontoCuota(soloDigitos(e.target.value))}
                placeholder="0"
                className="w-full rounded-[12px] border border-border bg-white/5 px-4 py-3 font-sora text-[18px] font-bold text-text outline-none focus:border-accent2"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
                Cuotas totales
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={cuotas}
                onChange={(e) => setCuotas(soloDigitos(e.target.value))}
                placeholder="12"
                className="w-full rounded-[12px] border border-border bg-white/5 px-4 py-3 font-sora text-[18px] font-bold text-text outline-none focus:border-accent2"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
              Ciclo de la cuota 1
            </span>
            <input
              type="month"
              value={desdeCiclo}
              onChange={(e) => setDesdeCiclo(e.target.value)}
              className="w-full rounded-[12px] border border-border bg-white/5 px-4 py-3 text-[14px] text-text outline-none focus:border-accent2"
            />
          </label>

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
            {guardando ? "Guardando…" : inicial ? "Guardar cambios" : "Agregar plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
