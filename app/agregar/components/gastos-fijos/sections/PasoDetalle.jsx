import SectionLabel from "@/app/components/ui/SectionLabel";

export default function PasoDetalle({
  item,
  monto,
  setMonto,
  fecha,
  setFecha,

  groups,

  selectedGroupId,
  setSelectedGroupId,
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* RESUMEN */}

      <div className="rounded-[16px] border border-accent/25 bg-accent/10 px-4 py-4">
        <p className="font-sora text-[15px] font-semibold text-text">
          {item.nombre}
        </p>

        <p className="mt-1 text-[12px] text-text-muted">
          {item.compartido
            ? "Compartido"
            : "Personal"}
        </p>
      </div>

      {/* MONTO */}

      <div className="flex flex-col gap-2">
        <SectionLabel>
          Monto
        </SectionLabel>

        <input
          type="number"
          placeholder="0"
          value={monto}
          onChange={(e) =>
            setMonto(
              e.target.value,
            )
          }
        />
      </div>

      {/* MES */}

      <div className="flex flex-col gap-2">
        <SectionLabel>
          Mes
        </SectionLabel>

        <input
          type="month"
          value={fecha}
          onChange={(e) =>
            setFecha(
              e.target.value,
            )
          }
        />
      </div>

      {/* GRUPO */}

      {item.compartido && (
        <div className="flex flex-col gap-2">
          <SectionLabel>
            Grupo
          </SectionLabel>

          {groups.map((g) => {
            const active =
              selectedGroupId ===
              g.id;

            return (
              <button
                key={g.id}
                type="button"
                onClick={() =>
                  setSelectedGroupId(
                    g.id,
                  )
                }
                className={`w-full rounded-[14px] px-4 py-[13px] text-left text-[14px] transition-all duration-150
                ${
                  active
                    ? "border border-accent/60 bg-accent/18 text-accent-light"
                    : "border border-border bg-white/3 text-text"
                }`}
              >
                {g.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}