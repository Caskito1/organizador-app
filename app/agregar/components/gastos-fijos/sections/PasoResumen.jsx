export default function PasoResumen({
  item,
  monto,
  fecha,
  loading,
  handleSubmit,
}) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      {/* CARD RESUMEN */}

      <div className="rounded-[20px] border border-accent/25 bg-accent/10 px-5 py-5">
        <p className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
          Resumen
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <div>
            <p className="text-[11px] text-text-muted">
              Servicio
            </p>

            <p className="font-sora text-[16px] font-semibold text-text">
              {item.nombre}
            </p>
          </div>

          <div>
            <p className="text-[11px] text-text-muted">
              Tipo
            </p>

            <p className="text-[14px] text-text">
              {item.compartido
                ? "Compartido"
                : "Personal"}
            </p>
          </div>

          <div>
            <p className="text-[11px] text-text-muted">
              Mes
            </p>

            <p className="text-[14px] text-text">
              {fecha}
            </p>
          </div>

          <div>
            <p className="text-[11px] text-text-muted">
              Monto
            </p>

            <p className="font-sora text-[28px] font-bold tracking-[-1px] text-accent-light">
              $
              {Number(
                monto,
              ).toLocaleString(
                "es-UY",
              )}
            </p>
          </div>
        </div>
      </div>

      {/* INFO BALANCE */}

      {item.compartido && (
        <div className="rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-white/3 px-4 py-4">
          <p className="text-[12px] leading-[1.6] text-text-muted">
            Este gasto quedará
            registrado como
            compartido y generará
            un balance pendiente
            entre integrantes del
            grupo.
          </p>
        </div>
      )}

      {/* SUBMIT */}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        className={`mt-2 w-full rounded-[16px] py-[15px] text-[15px] font-bold text-white transition-all duration-200 ${
          loading
            ? "bg-accent/30"
            : "bg-gradient-to-br from-[#9d7bff] to-[#5b35d5] shadow-[0_8px_28px_rgba(138,100,255,0.38)]"
        }`}
      >
        {loading
          ? "Guardando..."
          : "Guardar gasto fijo"}
      </button>
    </div>
  );
}