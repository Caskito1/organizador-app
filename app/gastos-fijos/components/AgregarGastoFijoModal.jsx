"use client";

import { useState } from "react";

export default function AgregarGastoFijoModal({
  catalogo,
  onClose,
  onSave,
}) {
  const [selected, setSelected] = useState(null);
  const [monto, setMonto] = useState("");
  const [esFijo, setEsFijo] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!selected) return;
    setLoading(true);
    try {
      await onSave({
        expenseId: selected.id,
        montoDefault: esFijo && monto ? Number(monto) : null,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  }

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

        <h2 className="font-sora text-[17px] font-bold text-text mb-1">
          Agregar gasto fijo
        </h2>
        <p className="text-[12px] text-text-muted mb-4">
          Elegí de la lista y configurá el monto
        </p>

        {/* LISTA */}
        <div className="flex flex-col gap-2 mb-4 max-h-[240px] overflow-y-auto">
          {catalogo.length === 0 ? (
            <p className="text-[13px] text-text-muted text-center py-4">
              Ya tenés todos los gastos activados
            </p>
          ) : (
            catalogo.map((item) => {
              const active = selected?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item)}
                  className={`w-full flex items-center gap-3 rounded-[14px] border px-4 py-[11px] text-left transition-all ${
                    active
                      ? "border-accent/60 bg-accent/18 text-accent-light"
                      : "border-border bg-white/3 text-text"
                  }`}
                >
                  <span className="text-[18px]">{item.icon}</span>
                  <div>
                    <p className="text-[14px] font-semibold">{item.nombre}</p>
                    <p className="text-[11px] text-text-muted capitalize">{item.frecuencia}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* MONTO FIJO */}
        {selected && (
          <div className="flex flex-col gap-3">
            {/* Toggle monto fijo */}
            <button
              type="button"
              onClick={() => { setEsFijo((v) => !v); setMonto(""); }}
              className={`flex items-center justify-between w-full rounded-[14px] border px-4 py-[11px] transition-all ${
                esFijo
                  ? "border-accent/60 bg-accent/18"
                  : "border-border bg-white/3"
              }`}
            >
              <div>
                <p className={`text-[14px] font-semibold ${esFijo ? "text-accent-light" : "text-text"}`}>
                  Monto fijo mensual
                </p>
                <p className="text-[11px] text-text-muted">
                  {esFijo ? "Se pre-carga automáticamente" : "El monto varía cada mes"}
                </p>
              </div>
              <div className={`w-[38px] h-[22px] rounded-full transition-all ${esFijo ? "bg-accent" : "bg-white/15"}`}>
                <div className={`w-[18px] h-[18px] rounded-full bg-white mt-[2px] transition-all ${esFijo ? "ml-[18px]" : "ml-[2px]"}`} />
              </div>
            </button>

            {/* Input monto */}
            {esFijo && (
              <div className="relative overflow-hidden rounded-[18px] border border-accent/30 bg-gradient-to-br from-accent/15 to-[#5b35d5]/20 px-[18px] py-4">
                <p className="mb-[6px] text-[11px] font-medium tracking-[0.5px] text-[#c8aeffa6]">
                  MONTO FIJO ($)
                </p>
                <div className="flex items-center gap-1">
                  <span className="font-sora text-[22px] font-bold text-accent-light">$</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    className="w-full border-none bg-transparent p-0 font-sora text-[28px] font-bold tracking-[-1px] text-text outline-none focus:ring-0"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* SUBMIT */}
            <button
              onClick={handleSave}
              disabled={loading || (esFijo && !monto)}
              className={`w-full rounded-[16px] py-[14px] text-[15px] font-bold text-white transition-all ${
                loading || (esFijo && !monto)
                  ? "bg-accent/30 cursor-default"
                  : "bg-gradient-to-br from-[#9d7bff] to-[#5b35d5] shadow-[0_8px_28px_rgba(138,100,255,0.38)] cursor-pointer"
              }`}
            >
              {loading ? "Guardando..." : `Agregar ${selected.nombre}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}