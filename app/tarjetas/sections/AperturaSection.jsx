// tarjetas/sections/AperturaSection.jsx
// Deuda de apertura (6.2, §12.9). A-5: ⋮ solo si ninguna cuota del plan cayó
// en un ciclo pagado/consolidado.

"use client";

import GlassCard from "@/app/components/layout/GlassCard";
import { formatearMonto, formatearUSD } from "@/app/balances/helpers/formato";

import BotonOpciones from "../components/BotonOpciones";
import { etiquetaCuota } from "../helpers/cuota";

export default function AperturaSection({ apertura, esEditable, onMenu, onAgregar }) {
  return (
    <GlassCard>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-text">Deuda de apertura</p>

        <button
          type="button"
          onClick={onAgregar}
          className="cursor-pointer rounded-[10px] border border-accent/40 bg-accent/10 px-3 py-[6px] text-[11px] font-semibold text-accent-light transition-all hover:bg-accent/20"
        >
          Agregar plan
        </button>
      </div>

      {apertura.length === 0 ? (
        <p className="mt-3 text-[12px] text-text-muted">
          Sin planes de apertura.
        </p>
      ) : (
        <div className="mt-2">
          {apertura.map(({ plan, cuota }) => {
            const monto =
              plan.moneda === "USD"
                ? formatearUSD(plan.montoCuota)
                : formatearMonto(plan.montoCuota);
            const editable = esEditable(plan);

            return (
              <div
                key={plan.id}
                className="flex items-start justify-between gap-3 border-b border-[rgba(138,100,255,0.1)] py-[10px] last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-text">
                    {plan.descripcion}
                  </p>
                  <p className="mt-[1px] text-[10px] text-text-muted">
                    {cuota
                      ? `Cuota ${etiquetaCuota(cuota.cuotaActual, plan.cuotasTotal)} · quedan ${cuota.cuotasRestantes}`
                      : "Fuera de este ciclo"}
                  </p>
                </div>

                <div className="flex flex-shrink-0 items-center gap-1">
                  <span className="font-sora text-[13px] font-semibold text-text">
                    {monto}
                  </span>
                  {editable && (
                    <BotonOpciones
                      etiqueta="Acciones"
                      onClick={() => onMenu(plan)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
