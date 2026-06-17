"use client";

import { useState } from "react";


export default function PagarModal({ gasto, estado, onClose, onSave }) {
const esAnual = gasto.frecuencia === "anual";
const tieneDefault = !!gasto.montoDefault;

const [monto, setMonto] = useState(
  gasto.entry?.montoTotal ?? gasto.montoDefault ?? ""
);
  const [vencimiento, setVencimiento] = useState(gasto.entry?.vencimiento ?? "");
  const [pagoHasta, setPagoHasta] = useState(gasto.entry?.pagoHasta ?? "");
  const [editandoMonto, setEditandoMonto] = useState(!tieneDefault);
  const [loading, setLoading] = useState(false);

  const isEdit = estado === "sin_registrar" || estado === "pagado_hasta";
  const isPayment = estado === "pendiente_pago";

  async function handleSave() {
    if (!monto) return;
    setLoading(true);
    try {
      await onSave({ monto: Number(monto), vencimiento, pagoHasta: pagoHasta || null });
    } finally {
      setLoading(false);
    }
  }

  const buttonText = isPayment ? "Confirmar pago" : "Guardar";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[4px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[430px] rounded-t-[28px] bg-[rgba(18,14,28,0.97)] border-t border-border px-5 pt-5 pb-[100px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-[4px] w-[40px] rounded-full bg-[rgba(255,255,255,0.15)]" />

        <h2 className="font-sora text-[17px] font-bold text-text mb-1">{gasto.nombre}</h2>

        {gasto.categoria === "compartido" && isEdit && (
          <p className="text-[12px] text-text-muted mb-2">
            Compartido 50/50 · tu parte:{" "}
            {monto ? `$${(Number(monto) / 2).toLocaleString("es-AR")}` : "-"}
          </p>
        )}

        <div className="flex flex-col gap-3 mt-4">

          {/* MONTO — con opción de editar si tiene default */}
          {isEdit && (
            <div>
              {tieneDefault && !editandoMonto ? (
                // Monto fijo predeterminado — mostrar con botón editar
                <div className="rounded-[18px] border border-accent/30 bg-gradient-to-br from-accent/15 to-[#5b35d5]/20 px-[18px] py-4 flex justify-between items-center">
                  <div>
                    <p className="text-[11px] font-medium tracking-[0.5px] text-[#c8aeffa6] mb-[4px]">
                      MONTO TOTAL ($)
                    </p>
                    <p className="font-sora text-[28px] font-bold text-text">
                      ${Number(monto).toLocaleString("es-AR")}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditandoMonto(true)}
                    className="text-[12px] text-accent-light border border-accent/30 rounded-[10px] px-3 py-[6px]"
                  >
                    ✏ Editar
                  </button>
                </div>
              ) : (
                // Input libre
                <div className="relative overflow-hidden rounded-[18px] border border-accent/30 bg-gradient-to-br from-accent/15 to-[#5b35d5]/20 px-[18px] py-4">
                  <p className="mb-[6px] text-[11px] font-medium tracking-[0.5px] text-[#c8aeffa6]">
                    MONTO TOTAL ($)
                  </p>
                  <div className="flex items-center gap-1">
                    <span className="font-sora text-[22px] font-bold text-accent-light">$</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      className="w-full border-none bg-transparent p-0 font-sora text-[28px] font-bold tracking-[-1px] text-text outline-none focus:ring-0"
                      autoFocus={editandoMonto && tieneDefault}
                    />
                  </div>
                  {tieneDefault && (
                    <button
                     onClick={() => {
                        setMonto(gasto.montoDefault);
                        setEditandoMonto(false);
                      }}
                      className="mt-2 text-[11px] text-text-muted"
                    >
                      ↩ Volver al monto por defecto
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* REGISTRAR PAGO — mostrar monto registrado */}
          {isPayment && (
            <>
              <div className="rounded-[18px] border border-border bg-white/3 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.4px] text-text-muted mb-1">
                  Monto registrado
                </p>
                <p className="font-sora text-[26px] font-bold text-text">
                  ${Number(gasto.entry?.montoTotal ?? 0).toLocaleString("es-AR")}
                </p>
              </div>

              {gasto.entry?.vencimiento && (
                <div className="rounded-[14px] border border-border bg-white/3 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.4px] text-text-muted mb-1">Vencimiento</p>
                  <p className="text-[14px] text-text">{gasto.entry.vencimiento}</p>
                </div>
              )}

              <div className="rounded-[14px] border border-[rgba(94,224,197,0.2)] bg-[rgba(94,224,197,0.08)] px-4 py-3">
                <p className="text-[13px] text-text">¿Confirmás que realizaste el pago?</p>
              </div>
            </>
          )}

          {/* PAGO HASTA — solo para anuales en modo edit */}
          {isEdit && esAnual && (
            <div className="flex flex-col gap-[6px]">
              <p className="text-[11px] uppercase tracking-[0.4px] text-text-muted">
                Pago hasta (periodo cubierto)
              </p>
              <input
                type="month"
                value={pagoHasta}
                onChange={(e) => setPagoHasta(e.target.value)}
                className="rounded-[14px] border border-border bg-white/3 px-4 py-3 text-[14px] text-text"
              />
              <p className="text-[11px] text-text-muted">
                Ej: si pagaste hasta diciembre 2027, poné 2027-12
              </p>
            </div>
          )}

          {/* VENCIMIENTO — para mensuales */}
          {isEdit && !esAnual && (
            <div className="flex flex-col gap-[6px]">
              <p className="text-[11px] uppercase tracking-[0.4px] text-text-muted">
                Fecha de vencimiento (opcional)
              </p>
              <input
                type="date"
                value={vencimiento}
                onChange={(e) => setVencimiento(e.target.value)}
                className="rounded-[14px] border border-border bg-white/3 px-4 py-3 text-[14px] text-text"
              />
            </div>
          )}

          {/* SUBMIT */}
          <button
            onClick={handleSave}
            disabled={loading || !monto}
            className={`w-full rounded-[16px] py-[14px] text-[15px] font-bold text-white transition-all ${
              loading || !monto
                ? "bg-accent/30 cursor-default"
                : "bg-gradient-to-br from-[#9d7bff] to-[#5b35d5] shadow-[0_8px_28px_rgba(138,100,255,0.38)] hover:scale-[1.01] cursor-pointer"
            }`}
          >
            {loading ? "Guardando..." : buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}