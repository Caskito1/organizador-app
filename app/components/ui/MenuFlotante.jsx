"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// Menú contextual flotante (Editar/Eliminar) renderizado en document.body.
//
// Motivo: el menú vive dentro de un acordeón con `backdrop-blur` (crea
// contexto de apilado) y, con varias secciones abiertas, el siguiente
// acordeón lo tapaba. El portal lo saca de ese contexto y de cualquier
// `overflow-hidden` (acordeón o tarjeta de banda).
//
// La posición se calcula en el handler de apertura (donde leer el ref es
// válido) y se pasa como `pos`. Se cierra al scrollear o redimensionar para
// no quedar desanclado.

const MENU_ESTIMATED_HEIGHT = 120;
const MARGIN = 8;

// `anchor`: elemento DOM del ancla (la fila). Devuelve { top | bottom, right }.
export function calcularPosicionMenu(anchor) {
  if (!anchor) return null;

  const rect = anchor.getBoundingClientRect();
  const right = Math.max(MARGIN, window.innerWidth - rect.right);

  if (rect.bottom + MENU_ESTIMATED_HEIGHT <= window.innerHeight - MARGIN) {
    return { top: rect.bottom + 4, right };
  }

  return { bottom: window.innerHeight - rect.top + 4, right };
}

export default function MenuFlotante({
  open,
  pos,
  onClose,
  children,
}) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const close = () => onCloseRef.current?.();

    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);

    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  if (!open || !pos || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[90]"
        onClick={() => onCloseRef.current?.()}
      />

      <div
        className="fixed z-[100] min-w-[160px] rounded-[14px] border border-border bg-[rgba(18,14,28,0.97)] backdrop-blur-[16px] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
        style={{
          top: pos.top,
          bottom: pos.bottom,
          right: pos.right,
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
