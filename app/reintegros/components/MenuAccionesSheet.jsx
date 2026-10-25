// reintegros/components/MenuAccionesSheet.jsx
// 4.3-bis (24/10/2026) — Hoja del menú ⋮ «Acciones» de FilaReintegro, montada
// a nivel de page.jsx (mismo patrón que ConfirmarAccionModal / ReintegroModal):
// fuera de los acordeones (overflow-hidden + backdrop-blur recortan los hijos
// `fixed`) y DENTRO del contenido de la app, para que el BottomNav (fixed
// z-50, después en el DOM) quede por encima — igual que en /agregar.
// MODAL_SHEET_CLASSES conserva su padding inferior (125px + safe-area).

"use client";

import { MODAL_SHEET_CLASSES } from "@/app/components/ui/modalSheet";

export default function MenuAccionesSheet({ menu, onClose }) {
  const { r, entrega, items } = menu;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[4px]"
      onClick={onClose}
    >
      <div className={MODAL_SHEET_CLASSES} onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-[4px] w-[40px] rounded-full bg-[rgba(255,255,255,0.15)]" />

        <h2 className="mb-1 font-sora text-[17px] font-bold text-text">
          Acciones
        </h2>
        <p className="mb-4 text-[12px] text-text-muted">
          {r.concepto}
          {entrega
            ? ` · Pago de ${entrega.realizadoPorNombre || ""}`
            : ` · ${r.contraparteNombre}`}
        </p>

        <div className="flex flex-col gap-2">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => {
                onClose();
                it.onSelect();
              }}
              className={`min-h-[44px] w-full cursor-pointer rounded-[14px] border px-4 py-3 text-left text-[14px] font-semibold transition-all ${
                it.danger
                  ? "border-negative/40 bg-negative/10 text-negative hover:bg-negative/15"
                  : "border-border bg-white/4 text-text hover:bg-white/8"
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-[16px] border border-border bg-white/3 py-[12px] text-[14px] font-semibold text-text-muted transition-all hover:bg-white/8 hover:text-text"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
