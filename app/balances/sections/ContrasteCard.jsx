// balances/sections/ContrasteCard.jsx
// Bloque 2 «Contraste» (5.2, C-5): esperada · real · diferencia. Nada más.
// La diferencia se muestra, no se ajusta (C-13).

"use client";

import GlassCard from "@/app/components/layout/GlassCard";

import BotonOpciones from "../components/BotonOpciones";
import { formatearMonto } from "../helpers/formato";

function Fila({ etiqueta, monto, detalle, tono = "text-text" }) {
  return (
    <div className="flex items-start justify-between gap-3 py-[5px]">
      <div>
        <p className="text-[12px] text-text-muted">{etiqueta}</p>
        {detalle && (
          <p className="mt-[1px] text-[10px] text-text-muted">{detalle}</p>
        )}
      </div>

      <span className={`font-sora text-[13px] font-semibold ${tono}`}>
        {monto === null || monto === undefined ? "—" : formatearMonto(monto)}
      </span>
    </div>
  );
}

function tonoDiferencia(diferencia) {
  if (diferencia === null || diferencia === undefined) return "text-text";
  if (diferencia === 0) return "text-text";

  return diferencia > 0 ? "text-[var(--positive)]" : "text-negative";
}

export default function ContrasteCard({
  fila,
  esEnCurso,
  onCierre,
}) {
  return (
    <GlassCard>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-text">Contraste</p>
          <p className="mt-[2px] text-[11px] text-text-muted">
            Caja esperada · real · diferencia
          </p>
        </div>

        {esEnCurso ? (
          <span className="shrink-0 rounded-[10px] border border-border px-2 py-1 text-[10px] text-text-muted">
            Se carga al cierre
          </span>
        ) : (
          <BotonOpciones
            etiqueta="Cargar caja real al cierre"
            onClick={onCierre}
          />
        )}
      </div>

      <div className="mt-3 border-t border-border pt-2">
        <Fila
          etiqueta="Caja esperada al cierre"
          monto={fila.cajaEsperadaAlCierre}
        />
        <Fila
          etiqueta="Caja real al cierre"
          monto={fila.cajaRealAlCierre}
          detalle={
            fila.cajaRealAlCierre === null ? "Sin cierre cargado" : null
          }
        />
        <Fila
          etiqueta="Diferencia"
          monto={fila.diferencia}
          tono={tonoDiferencia(fila.diferencia)}
        />
      </div>

      <p className="mt-2 text-[10px] text-text-muted">
        Diferencia = esperada − real. Se muestra, no se ajusta.
      </p>
    </GlassCard>
  );
}
