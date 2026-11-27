// tarjetas/components/FilaCompra.jsx
// Fila de una compra del ciclo (6.2):
//   izquierda: detalle · fecha · tag de tipo (Personal / Reintegro)
//   derecha: cuota (n/total) · precio de la CUOTA (+ ⋮ si editable)
// El precio de la fila es el MONTO DE LA CUOTA, no el total de la compra.

"use client";

import { formatearFecha, formatearMonto, formatearUSD } from "@/app/balances/helpers/formato";

import { etiquetaCuota } from "../helpers/cuota";
import BotonOpciones from "./BotonOpciones";

export default function FilaCompra({ compra, cuota, editable, onMenu, vinculo, onRecrear }) {
  const precio =
    compra.moneda === "USD"
      ? formatearUSD(cuota.monto)
      : formatearMonto(cuota.monto);

  return (
    <div className="flex items-start justify-between gap-3 border-b border-[rgba(138,100,255,0.1)] py-[10px] last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-text">
          {compra.detalle || "Compra"}
        </p>
        <p className="mt-[1px] text-[10px] text-text-muted">
          {formatearFecha(compra.fecha)}
        </p>
        <span className="mt-[2px] inline-block rounded-[4px] border border-border bg-white/4 px-[4px] text-[9px] text-text-muted">
          {compra.tipo === "reintegro" ? "Reintegro" : "Personal"}
        </span>

        {vinculo?.estado === "eliminada" && (
          <div className="mt-[3px]">
            <p className="text-[9px] font-semibold text-negative">
              Reintegro eliminado en /reintegros
            </p>
            {Number(vinculo.devuelto || 0) === 0 ? (
              <button
                type="button"
                onClick={() => onRecrear?.(compra)}
                className="mt-[2px] cursor-pointer rounded-[6px] border border-accent2/40 bg-accent/12 px-[5px] py-[2px] text-[9px] font-semibold text-accent-light"
              >
                Recrear reintegro
              </button>
            ) : (
              <p className="text-[9px] text-text-muted">
                Tiene cobros: requiere revisión manual.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        <div className="flex flex-col items-end gap-[1px]">
          <span className="text-[10px] text-text-muted">
            {etiquetaCuota(cuota.n, cuota.total)}
          </span>
          <span className="font-sora text-[13px] font-semibold text-text">
            {precio}
          </span>
        </div>

        {editable && (
          <BotonOpciones etiqueta="Acciones" onClick={() => onMenu(compra)} />
        )}
      </div>
    </div>
  );
}
