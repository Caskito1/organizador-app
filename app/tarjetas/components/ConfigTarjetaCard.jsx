// tarjetas/components/ConfigTarjetaCard.jsx
// Configuración de la tarjeta (6.2, §12.5): alta inicial y edición.
// Se muestra inline (sin tarjeta) o en modo edición (con Cancelar).

"use client";

import { useState } from "react";

import GlassCard from "@/app/components/layout/GlassCard";

function soloDigitos(valor) {
  return valor.replace(/[^\d]/g, "");
}

export default function ConfigTarjetaCard({
  inicial,
  onGuardar,
  onCancelar,
  guardando,
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "OCA");
  const [diaCierre, setDiaCierre] = useState(
    inicial?.diaCierre ? String(inicial.diaCierre) : "18",
  );
  const [diaVencimiento, setDiaVencimiento] = useState(
    inicial?.diaVencimiento ? String(inicial.diaVencimiento) : "30",
  );
  const [activa, setActiva] = useState(inicial?.activa ?? true);
  const [error, setError] = useState(null);

  async function guardar() {
    setError(null);

    const cierre = Number(diaCierre);
    const vencimiento = Number(diaVencimiento);

    if (!nombre.trim()) return setError("El nombre de la tarjeta es obligatorio.");
    if (!Number.isInteger(cierre) || cierre < 1 || cierre > 28) {
      return setError("El día de cierre debe ser un entero entre 1 y 28.");
    }
    if (!Number.isInteger(vencimiento) || vencimiento < 1 || vencimiento > 31) {
      return setError("El día de vencimiento debe ser un entero entre 1 y 31.");
    }

    try {
      await onGuardar({
        nombre: nombre.trim(),
        diaCierre: cierre,
        diaVencimiento: vencimiento,
        activa,
      });
      if (onCancelar) onCancelar();
    } catch (e) {
      setError(e?.message ?? "No se pudo guardar la configuración.");
    }
  }

  return (
    <GlassCard>
      <p className="text-[13px] font-semibold text-text">
        {inicial ? "Ajustes de la tarjeta" : "Configurá tu tarjeta"}
      </p>
      <p className="mt-1 text-[11px] leading-[1.5] text-text-muted">
        El cierre y el vencimiento son datos de la tarjeta (OCA: cierre 18,
        vencimiento 30). Una compra el día del cierre pertenece a ese ciclo; el
        día siguiente abre el próximo.
      </p>

      <div className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
            Nombre
          </span>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={40}
            className="w-full rounded-[12px] border border-border bg-white/5 px-4 py-3 text-[14px] text-text outline-none focus:border-accent2"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
              Día de cierre
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={diaCierre}
              onChange={(e) => setDiaCierre(soloDigitos(e.target.value))}
              className="w-full rounded-[12px] border border-border bg-white/5 px-4 py-3 text-[14px] text-text outline-none focus:border-accent2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
              Día de vencimiento
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={diaVencimiento}
              onChange={(e) => setDiaVencimiento(soloDigitos(e.target.value))}
              className="w-full rounded-[12px] border border-border bg-white/5 px-4 py-3 text-[14px] text-text outline-none focus:border-accent2"
            />
          </label>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={activa}
            onChange={(e) => setActiva(e.target.checked)}
            className="h-[16px] w-[16px] accent-[var(--accent)]"
          />
          <span className="text-[12px] text-text-muted">Tarjeta activa</span>
        </label>
      </div>

      {error && (
        <div className="mt-3 rounded-[10px] bg-negative/10 px-[14px] py-[10px] text-[13px] text-negative">
          {error}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            disabled={guardando}
            className="w-[38%] cursor-pointer rounded-[16px] border border-border py-[12px] text-[14px] font-semibold text-text-muted"
          >
            Cancelar
          </button>
        )}

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
          {guardando ? "Guardando…" : "Guardar tarjeta"}
        </button>
      </div>
    </GlassCard>
  );
}
