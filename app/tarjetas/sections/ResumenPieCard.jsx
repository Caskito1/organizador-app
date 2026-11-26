// tarjetas/sections/ResumenPieCard.jsx
// Resumen al pie del ciclo (6.2, §12.7): tras una raya.
// Personales (incluye apertura UNA sola vez) · Reintegros · Total · Deuda.
// Invariante que garantiza resumenCiclo: Personales + Reintegros = Total.

"use client";

import GlassCard from "@/app/components/layout/GlassCard";
import { formatearMonto, formatearUSD } from "@/app/balances/helpers/formato";

function Monto({ valor }) {
  return (
    <span className="text-right">
      <span className="block font-sora text-[13px] font-semibold text-text">
        {formatearMonto(valor.UYU)}
      </span>
      {valor.USD > 0 && (
        <span className="block text-[10px] text-[var(--user-b)]">
          {formatearUSD(valor.USD)}
        </span>
      )}
    </span>
  );
}

function Fila({ etiqueta, valor, detalle, fuerte }) {
  return (
    <div className="flex items-start justify-between gap-3 py-[5px]">
      <div className="min-w-0">
        <p
          className={`text-[12px] ${
            fuerte ? "font-semibold text-text" : "text-text-muted"
          }`}
        >
          {etiqueta}
        </p>
        {detalle && (
          <p className="mt-[1px] text-[10px] text-text-muted">{detalle}</p>
        )}
      </div>
      <Monto valor={valor} />
    </div>
  );
}

export default function ResumenPieCard({ resumen }) {
  return (
    <GlassCard>
      <div className="border-t border-border pt-2">
        <Fila
          etiqueta="Personales"
          valor={resumen.personales}
          detalle="incluye apertura"
        />
        <Fila etiqueta="Reintegros" valor={resumen.reintegros} />
        <Fila etiqueta="Total" valor={resumen.total} fuerte />
        <Fila
          etiqueta="Deuda · cuotas por vencer"
          valor={resumen.deudaPorVencer}
          detalle={`${resumen.cuotasPorVencer} cuota(s)`}
        />
      </div>
    </GlassCard>
  );
}
