"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";

export default function FilaGasto({
  gasto,
  usuarioNombre,
  onEdit,
  onDelete,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimer = useRef(null);


  const { user } = useAuth();
  const fecha =
    gasto.createdAt?.toDate?.() ??
    new Date(gasto.createdAt);

  const subtitulo =
    gasto.tipo === "transferencia"
      ? `${gasto.detalle || "Transferencia"} · ${fecha.toLocaleDateString()}`
      : `${gasto.categoria ?? ""} · ${fecha.toLocaleDateString()}`;

  // Long press handlers
  function handlePressStart() {
  if (!puedeEditar) return;

  longPressTimer.current = setTimeout(() => setMenuOpen(true), 500);
}

  function handlePressEnd() {
    clearTimeout(longPressTimer.current);
  }

  const esTransferencia = gasto.tipo === "transferencia";
const puedeEditar =
  gasto.tipo === "personal" ||
  gasto.usuario === user?.uid;

  return (
    <div className="relative">
      <div
        className="flex justify-between border-b border-[rgba(138,100,255,0.1)] py-[10px] select-none group"
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium capitalize text-text">
            {gasto.producto}
          </p>
          <p className="mt-[2px] text-[11px] text-text-muted">
            {subtitulo}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Botón ⋯ — visible en hover desktop, oculto en mobile */}
         {!esTransferencia && puedeEditar && (
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity w-[24px] h-[24px] flex items-center justify-center rounded-[6px] text-text-muted hover:text-text hover:bg-white/8"
            >
              ⋯
            </button>
          )}

          <div className="text-right">
            <p className="font-sora text-[14px] font-bold text-text">
              ${Number(gasto.monto).toLocaleString("es-AR")}
            </p>
            <span className="text-[11px] text-text-muted">{usuarioNombre}</span>
          </div>
        </div>
      </div>

      {/* Menú contextual */}
      {menuOpen && !esTransferencia && puedeEditar && (
        <>
          {/* Overlay para cerrar */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 top-[36px] z-50 min-w-[160px] rounded-[14px] border border-border bg-[rgba(18,14,28,0.97)] backdrop-blur-[16px] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <button
              onClick={() => { setMenuOpen(false); onEdit?.(gasto); }}
              className="flex items-center gap-2 w-full px-4 py-[11px] text-left text-[14px] text-text hover:bg-white/5 transition-colors"
            >
              ✏ Editar
            </button>
            <div className="h-[1px] bg-border mx-3" />
            <button
              onClick={() => { setMenuOpen(false); onDelete?.(gasto); }}
              className="flex items-center gap-2 w-full px-4 py-[11px] text-left text-[14px] text-[var(--negative)] hover:bg-[rgba(255,100,100,0.08)] transition-colors"
            >
              🗑 Eliminar
            </button>
          </div>
        </>
      )}
    </div>
  );
}