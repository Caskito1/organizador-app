import SelectBtn from "@/app/components/ui/SectionBtn";

export default function PasoTipo({
  tipos,
  tipoId,
  seleccionarTipo,
  seleccionarItem,
}) {
  return (
    <div className="flex flex-col gap-5">
      {Object.entries(tipos).map(
        ([id, tipo]) => (
          <div
            key={id}
            className="flex flex-col gap-2"
          >
            <h3 className="text-[12px] uppercase tracking-[0.5px] text-text-muted">
              {tipo.label}
            </h3>

            {tipo.items.map((item) => (
              <SelectBtn
                key={item.id}
                label={item.nombre}
                active={
                  tipoId === item.id
                }
                onClick={() => {
                  seleccionarTipo(id);

                  seleccionarItem(
                    item,
                  );
                }}
              />
            ))}
          </div>
        ),
      )}
    </div>
  );
}