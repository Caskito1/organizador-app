"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import MenuFlotante, {
  calcularPosicionMenu,
} from "@/app/components/ui/MenuFlotante";
import { fechaEfectiva } from "../helpers/dateHelpers";

export default function FilaGasto({
  gasto,
  usuarioNombre,
  onEdit,
  onDelete,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const longPressTimer = useRef(null);
  const anchorRef = useRef(null);


  const { user } = useAuth();
  // 4.5-fecha: se muestra la fecha del gasto (fallback createdAt).
  const fecha = fechaEfectiva(gasto);
  const fechaTexto = fecha ? fecha.toLocaleDateString() : "";

  const subtitulo = `${gasto.categoria ?? ""} · ${fechaTexto}`;

  // Long press handlers
  function abrirMenu() {
    setMenuPos(calcularPosicionMenu(anchorRef.current));
    setMenuOpen(true);
  }

  function handlePressStart() {
  if (!puedeEditar) return;

  longPressTimer.current = setTimeout(() => abrirMenu(), 500);
}

  function handlePressEnd() {
    clearTimeout(longPressTimer.current);
  }

const puedeEditar =
  gasto.tipo === "personal" ||
  gasto.usuario === user?.uid;

  return (
    <div className="relative" ref={anchorRef}>
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
         {puedeEditar && (
            <button
              onClick={(e) => { e.stopPropagation(); abrirMenu(); }}
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

      {/* Menú contextual (portal: no lo recorta ni lo tapa el acordeón) */}
      {puedeEditar && (
        <MenuFlotante
          open={menuOpen}
          pos={menuPos}
          onClose={() => setMenuOpen(false)}
        >
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
        </MenuFlotante>
      )}
    </div>
  );
}