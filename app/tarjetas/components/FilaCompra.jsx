// tarjetas/components/FilaCompra.jsx
// Fila de una compra del ciclo (6.2, §12.6): tipo · cuota n/total · monto.
// El ⋮ solo se muestra cuando la compra es editable (6.2 lo decide).

"use client";

import { formatearFecha, formatearMonto, formatearUSD } from "@/app/balances/helpers/formato";

import { etiquetaCuota } from "../helpers/cuota";
import BotonOpciones from "./BotonOpciones";

export default function FilaCompra({ compra, cuota, editable, onMenu }) {
  const monto =
    compra.moneda === "USD" ? formatearUSD(compra.monto) : formatearMonto(compra.monto);

  return (
    <div className="flex items-start justify-between gap-3 border-b border-[rgba(138,100,255,0.1)] py-[10px] last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded-[6px] border border-border bg-white/4 px-2 py-[1px] text-[10px] text-text-muted">
            {compra.tipo === "reintegro" ? "Reintegro" : "Personal"}
          </span>
          <span className="text-[10px] text-text-muted">
            {etiquetaCuota(cuota.n, cuota.total)}
          </span>
        </div>

        <p className="mt-[3px] truncate text-[13px] font-medium text-text">
          {compra.detalle || "Compra"}
        </p>
        <p className="mt-[1px] text-[10px] text-text-muted">
          {formatearFecha(compra.fecha)}
        </p>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1">
        <span className="font-sora text-[13px] font-semibold text-text">
          {monto}
        </span>
        {editable && (
          <BotonOpciones etiqueta="Acciones" onClick={() => onMenu(compra)} />
        )}
      </div>
    </div>
  );
}
