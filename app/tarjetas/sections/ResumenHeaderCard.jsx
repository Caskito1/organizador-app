// tarjetas/sections/ResumenHeaderCard.jsx
// Hero del ciclo (6.2): Total del resumen grande con el chip de estado en la
// ESQUINA SUPERIOR DERECHA, alineado con el monto; debajo, vencimiento y rango.
// Bimoneda: el total grande es UYU y el USD va aparte.

"use client";

import GlassCard from "@/app/components/layout/GlassCard";
import { formatearMonto, formatearUSD } from "@/app/balances/helpers/formato";

const ESTADOS = {
  sin_verificar: {
    label: "Sin verificar",
    clase: "border-border bg-white/4 text-text-muted",
  },
  por_pagar: {
    label: "Por pagar",
    clase: "border-accent2/50 bg-accent/15 text-accent-light",
  },
  pagada: {
    label: "Pagada",
    clase: "border-border bg-white/4 text-[var(--positive)]",
  },
};

export default function ResumenHeaderCard({
  estado,
  resumen,
  vencimientoLabel,
  rangoLabel,
}) {
  const chip = ESTADOS[estado] ?? ESTADOS.sin_verificar;

  return (
    <GlassCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
            Total del resumen
          </p>
          <p className="mt-1 font-sora text-[32px] font-bold leading-none text-text">
            {formatearMonto(resumen.total.UYU)}
          </p>
          {resumen.total.USD > 0 && (
            <p className="mt-1 font-sora text-[14px] font-semibold text-[var(--user-b)]">
              {formatearUSD(resumen.total.USD)}
            </p>
          )}
        </div>

        <span
          className={`shrink-0 rounded-[999px] border px-3 py-[4px] text-[10px] font-semibold ${chip.clase}`}
        >
          {chip.label}
        </span>
      </div>

      <p className="mt-3 text-[12px] text-text-muted">
        Resumen · {vencimientoLabel}
      </p>
      <p className="mt-[2px] text-[11px] text-text-muted">
        Compras del {rangoLabel}
      </p>
    </GlassCard>
  );
}
