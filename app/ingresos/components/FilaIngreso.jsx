"use client";

import { useRef, useState } from "react";

import MenuFlotante, {
  calcularPosicionMenu,
} from "@/app/components/ui/MenuFlotante";
import { fechaEfectiva } from "@/app/gastos/helpers/dateHelpers";
import {
  monedaEfectiva,
  simboloDe,
} from "@/app/ingresos/helpers/ingresosMoneda";

export default function FilaIngreso({
  ingreso,
  onEdit,
  onDelete,
  compact = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const longPressTimer = useRef(null);
  const anchorRef = useRef(null);

  // 4.5-fecha: se muestra la fecha del ingreso (fallback createdAt).
  const fecha = fechaEfectiva(ingreso);

  const titulo =
    ingreso.detalle ?? "Ingreso";

  const puedeEditar = !!onEdit || !!onDelete;

  function abrirMenu() {
    setMenuPos(calcularPosicionMenu(anchorRef.current));
    setMenuOpen(true);
  }

  function handlePressStart() {
    if (!puedeEditar) return;

    longPressTimer.current = setTimeout(
      () => abrirMenu(),
      500,
    );
  }

  function handlePressEnd() {
    clearTimeout(longPressTimer.current);
  }

  return (
    <div
      ref={anchorRef}
      className={`relative border-b ${
        compact
          ? "border-[rgba(138,100,255,0.08)] last:border-none"
          : "border-[rgba(94,224,197,0.08)]"
      }`}
    >
      <div
        className="flex justify-between py-[10px] select-none group"
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
      >
        <div className="min-w-0 flex-1">
          <p
            className={`font-medium text-text ${
              compact
                ? "text-[13px]"
                : "text-[14px]"
            }`}
          >
            {titulo}
          </p>

          <p className="mt-[2px] text-[11px] text-text-muted">
            {fecha
              ? fecha.toLocaleDateString()
              : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {puedeEditar && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                abrirMenu();
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity w-[24px] h-[24px] flex items-center justify-center rounded-[6px] text-text-muted hover:text-text hover:bg-white/8"
            >
              ⋯
            </button>
          )}

          <div className="self-center text-right">
            <p
              className={`font-sora font-bold ${
                compact
                  ? "text-[13px] text-text"
                  : "text-[15px] text-[var(--user-b)]"
              }`}
            >
              +{simboloDe(monedaEfectiva(ingreso))}
              {Number(
                ingreso.monto,
              ).toLocaleString("es-AR")}
            </p>
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
          {onEdit && (
            <button
              onClick={() => {
                setMenuOpen(false);
                onEdit(ingreso);
              }}
              className="flex items-center gap-2 w-full px-4 py-[11px] text-left text-[14px] text-text hover:bg-white/5 transition-colors"
            >
              ✏ Editar
            </button>
          )}

          {onEdit && onDelete && (
            <div className="h-[1px] bg-border mx-3" />
          )}

          {onDelete && (
            <button
              onClick={() => {
                setMenuOpen(false);
                onDelete(ingreso);
              }}
              className="flex items-center gap-2 w-full px-4 py-[11px] text-left text-[14px] text-[var(--negative)] hover:bg-[rgba(255,100,100,0.08)] transition-colors"
            >
              🗑 Eliminar
            </button>
          )}
        </MenuFlotante>
      )}
    </div>
  );
}
