// balances/sections/PendientesCard.jsx
// Bloque 3 «Pendientes» (5.2, C-6): stock por perspectiva y su fecha de corte.

"use client";

import GlassCard from "@/app/components/layout/GlassCard";

import { formatearFecha, formatearMonto } from "../helpers/formato";

function Fila({ etiqueta, monto }) {
  return (
    <div className="flex items-center justify-between gap-3 py-[5px]">
      <span className="text-[12px] text-text-muted">{etiqueta}</span>
      <span className="font-sora text-[13px] font-semibold text-text">
        {formatearMonto(monto)}
      </span>
    </div>
  );
}

export default function PendientesCard({ stock, esEnCurso }) {
  return (
    <GlassCard>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-text">Pendientes</p>
          <p className="mt-[2px] text-[11px] text-text-muted">
            {esEnCurso ? "Stock de hoy" : "Stock al cierre"} ·{" "}
            {formatearFecha(stock.corte)}
          </p>
        </div>
      </div>

      <div className="mt-3 border-t border-border pt-2">
        <Fila etiqueta="Por cobrar" monto={stock.pendienteCobro} />
        <Fila etiqueta="Por devolver" monto={stock.pendienteDevolucion} />
      </div>

      <p className="mt-2 text-[10px] text-text-muted">
        No es del mes: es el stock abierto a la fecha de corte.
      </p>
    </GlassCard>
  );
}
