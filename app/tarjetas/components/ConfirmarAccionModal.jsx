// tarjetas/components/ConfirmarAccionModal.jsx
// Confirmación de eliminación de una compra o un plan de apertura (6.2).

"use client";

import { useState } from "react";

import { MODAL_SHEET_CLASSES } from "@/app/components/ui/modalSheet";

export default function ConfirmarAccionModal({
  titulo,
  descripcion,
  boton = "Eliminar",
  peligro = true,
  onConfirmar,
  onClose,
  guardando,
}) {
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    if (enviando || guardando) return;

    setError(null);
    setEnviando(true);

    try {
      await onConfirmar();
      onClose();
    } catch (e) {
      setError(e?.message ?? "No se pudo completar.");
    } finally {
      setEnviando(false);
    }
  }

  const bloqueado = enviando || guardando;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[4px]"
      onClick={onClose}
    >
      <div className={MODAL_SHEET_CLASSES} onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-[4px] w-[40px] rounded-full bg-[rgba(255,255,255,0.15)]" />

        <h2 className="mb-1 font-sora text-[17px] font-bold text-text">
          {titulo}
        </h2>
        <p className="mb-4 text-[12px] leading-[1.55] text-text-muted">
          {descripcion}
        </p>

        {error && (
          <div className="mb-3 rounded-[10px] bg-negative/10 px-[14px] py-[10px] text-[13px] text-negative">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={confirmar}
          disabled={bloqueado}
          className={`w-full rounded-[16px] py-[14px] text-[15px] font-bold text-white transition-all ${
            bloqueado
              ? "cursor-default bg-accent/30"
              : peligro
                ? "cursor-pointer bg-gradient-to-br from-[#ff5f6d] to-[#c62f43] shadow-[0_8px_28px_rgba(214,63,67,0.32)] hover:scale-[1.01]"
                : "cursor-pointer bg-gradient-to-br from-[#9d7bff] to-[#5b35d5] shadow-[0_8px_28px_rgba(138,100,255,0.38)] hover:scale-[1.01]"
          }`}
        >
          {bloqueado ? "Eliminando…" : boton}
        </button>

        <button
          type="button"
          onClick={onClose}
          disabled={bloqueado}
          className="mt-2 w-full rounded-[16px] border border-border bg-white/3 py-[12px] text-[14px] font-semibold text-text-muted transition-all hover:bg-white/8 hover:text-text"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
