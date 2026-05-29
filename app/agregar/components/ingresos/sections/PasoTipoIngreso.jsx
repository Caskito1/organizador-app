// components/ingresos/sections/PasoTipoIngreso.jsx

import {
  BANDAS,
} from "../hooks/useModoIngreso";

export default function PasoTipoIngreso({
  tipo,
  subtipo,

  seleccionarTipo,
  seleccionarBanda,
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* SUELDO */}

      <button
        onClick={() =>
          seleccionarTipo(
            "sueldo",
          )
        }
        className={`w-full rounded-[18px] border px-5 py-5 text-left transition-all duration-200 ${
          tipo === "sueldo"
            ? "border-accent/60 bg-accent/15"
            : "border-border bg-glass"
        }`}
      >
        <p className="mb-1 font-sora text-[15px] font-bold text-text">
          Sueldo
        </p>

        <p className="text-[13px] text-text-muted">
          Ingreso principal mensual.
        </p>
      </button>

      {/* BANDAS */}

      <div className="rounded-[18px] border border-border bg-glass overflow-hidden">
        <button
          onClick={() =>
            seleccionarTipo(
              "banda",
            )
          }
          className={`w-full px-5 py-5 text-left transition-all duration-200 ${
            tipo === "banda"
              ? "bg-accent/10"
              : ""
          }`}
        >
          <p className="mb-1 font-sora text-[15px] font-bold text-text">
            Bandas
          </p>

          <p className="text-[13px] text-text-muted">
            La Ventolera, La Imbailable o Tapelao.
          </p>
        </button>

        {tipo === "banda" && (
          <div className="border-t border-border p-3 flex flex-col gap-2">
            {BANDAS.map((b) => {
              const active =
                subtipo === b.id;

              return (
                <button
                  key={b.id}
                  onClick={() =>
                    seleccionarBanda(
                      b.id,
                    )
                  }
                  className={`w-full rounded-[14px] border px-4 py-[13px] text-left text-[14px] transition-all duration-150 ${
                    active
                      ? "border-accent/60 bg-accent/18 text-accent-light"
                      : "border-border bg-white/3 text-text"
                  }`}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* FREELANCE */}

      <button
        onClick={() =>
          seleccionarTipo(
            "freelance",
          )
        }
        className={`w-full rounded-[18px] border px-5 py-5 text-left transition-all duration-200 ${
          tipo ===
          "freelance"
            ? "border-accent/60 bg-accent/15"
            : "border-border bg-glass"
        }`}
      >
        <p className="mb-1 font-sora text-[15px] font-bold text-text">
          Freelance
        </p>

        <p className="text-[13px] text-text-muted">
          Trabajos independientes.
        </p>
      </button>
       {/* OTRO */}
<button
  type="button"
  onClick={() =>
    seleccionarTipo("otros")
  }
  className="w-full rounded-[16px] border border-border bg-glass px-4 py-4 text-left transition-all duration-150 hover:border-accent2"
>
  <p className="font-sora text-[15px] font-semibold text-text">
    Otros
  </p>

  <p className="mt-[2px] text-[12px] text-text-muted">
    Otros ingresos personales.
  </p>
</button>
     
    </div>
  );
}