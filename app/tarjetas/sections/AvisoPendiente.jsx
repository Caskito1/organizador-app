// tarjetas/sections/AvisoPendiente.jsx
// 6.2-bis — Aviso de factura pendiente (ciclo pasado con datos y sin pagar).
// No recalcula nada: recibe el ciclo pendiente ya derivado por el hook.

"use client";

import GlassCard from "@/app/components/layout/GlassCard";

export default function AvisoPendiente({ etiqueta, bloqueado, onIr }) {
  return (
    <GlassCard>
      <p className="text-[13px] font-semibold text-text">
        Factura pendiente
      </p>
      <p className="mt-1 text-[12px] leading-[1.5] text-text-muted">
        Hay una factura sin cerrar o sin pagar
        {etiqueta ? ` (${etiqueta})` : ""}. Resolvela para volver a operar los
        ciclos posteriores.
      </p>
      {bloqueado && (
        <p className="mt-1 text-[11px] font-semibold text-[var(--negative)]">
          Este ciclo está bloqueado hasta resolver la factura pendiente.
        </p>
      )}
      {onIr && (
        <button
          type="button"
          onClick={onIr}
          className="mt-3 w-full cursor-pointer rounded-[12px] border border-accent/50 bg-accent/15 px-3 py-[9px] text-[12px] font-semibold text-accent-light transition-all hover:bg-accent/25"
        >
          Ir a {etiqueta} · sin pagar
        </button>
      )}
    </GlassCard>
  );
}
