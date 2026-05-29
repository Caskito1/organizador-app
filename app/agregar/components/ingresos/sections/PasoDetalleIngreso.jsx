// components/ingresos/sections/PasoDetalleIngreso.jsx

import SectionLabel from "@/app/components/ui/SectionLabel";

export default function PasoDetalleIngreso({
  modo,
  loading,
  canSubmit,
  handleSubmit,
}) {
  const detalleRequired =
    modo.tipo === "freelance" ||
    modo.tipo === "otros";

  const detalleLabel =
    modo.tipo === "freelance"
      ? "Freelance"
      : modo.tipo === "otros"
      ? "¿Qué ingreso fue?"
      : "Detalle";

  const detallePlaceholder =
    modo.tipo === "freelance"
      ? "Ej: Diseño web..."
      : modo.tipo === "otros"
      ? "Ej: Venta, regalo, devolución..."
      : "Ej: Fecha, evento, cliente...";

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
    >
      {/* RESUMEN */}

      <div className="rounded-[16px] border border-accent/25 bg-accent/10 backdrop-blur-[16px] px-4 py-[14px]">
        <p className="font-sora text-[14px] font-semibold text-text">
          {modo.tipoLabel}
        </p>

        {modo.subtipoLabel && (
          <p className="mt-[2px] text-[11px] text-text-muted">
            {modo.subtipoLabel}
          </p>
        )}
      </div>

      {/* DETALLE */}

      <div className="flex flex-col gap-2">
        <SectionLabel>
          {detalleRequired
            ? `${detalleLabel} (requerido)`
            : "Detalle (opcional)"}
        </SectionLabel>

        <input
          type="text"
          placeholder={detallePlaceholder}
          value={modo.detalle}
          onChange={(e) =>
            modo.setDetalle(
              e.target.value,
            )
          }
          required={detalleRequired}
        />
      </div>

      {/* MONTO */}

      <div className="relative overflow-hidden rounded-[22px] border border-accent/30 bg-gradient-to-br from-accent/15 to-[#5b35d5]/20 px-[22px] py-5 backdrop-blur-[20px]">
        <p className="mb-[10px] text-[11px] font-medium tracking-[0.5px] text-[#c8aeffa6]">
          MONTO ($)
        </p>

        <div className="flex items-center gap-1">
          <span className="font-sora text-[26px] font-bold leading-none text-accent-light">
            $
          </span>

          <input
            type="number"
            placeholder="0"
            value={modo.monto}
            onChange={(e) =>
              modo.setMonto(
                e.target.value,
              )
            }
            required
            className="w-full border-none bg-transparent p-0 font-sora text-[34px] font-bold tracking-[-1px] text-text outline-none focus:ring-0"
          />
        </div>
      </div>

      {/* SUBMIT */}

      <button
        type="submit"
        disabled={
          loading || !canSubmit
        }
        className={`mt-1 w-full rounded-[16px] py-[15px] text-[15px] font-bold text-white transition-all duration-200 ${
          !canSubmit || loading
            ? "cursor-default bg-accent/30"
            : "cursor-pointer bg-gradient-to-br from-[#9d7bff] to-[#5b35d5] shadow-[0_8px_28px_rgba(138,100,255,0.38)] hover:scale-[1.01]"
        }`}
      >
        {loading
          ? "Guardando..."
          : "Guardar ingreso"}
      </button>
    </form>
  );
}