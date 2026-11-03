import Acordeon from "@/app/gastos/components/Acordeon";

import FilaIngreso from "../components/FilaIngreso";

// Fuente unica de los labels. Los ids son los canonicos que escribe
// useModoIngreso y no se cambian. Duplicado por decision de alcance
// de 2.3: no se extrae a una taxonomia compartida.
import { BANDAS } from "@/app/agregar/components/ingresos/hooks/useModoIngreso";

const BANDA_LABEL = BANDAS.reduce(
  (acc, b) => {
    acc[b.id] = b.label;

    return acc;
  },
  {},
);

const labelBanda = (id) =>
  BANDA_LABEL[id] ?? id;

export default function BandasSection({
  ingresos,
  open,
  onToggle,
  onEdit,
  onDelete,
}) {
  const bandas = ingresos.reduce(
    (acc, ingreso) => {
      const key =
        ingreso.subtipo || "Sin banda";

      if (!acc[key]) {
        acc[key] = [];
      }

      acc[key].push(ingreso);

      return acc;
    },
    {},
  );

  const totalGeneral =
    ingresos.reduce(
      (a, i) =>
        a + Number(i.monto || 0),
      0,
    );

  return (
    <Acordeon
      titulo="Bandas"
      total={totalGeneral}
      open={open}
      onToggle={onToggle}
      empty={!ingresos.length}
    >
      <div className="flex flex-col gap-3">
        {Object.entries(bandas).map(
          ([banda, items]) => {
            const totalBanda =
              items.reduce(
                (a, i) =>
                  a +
                  Number(
                    i.monto || 0,
                  ),
                0,
              );

            // Sin overflow-hidden: el menú ⋯ de FilaIngreso (absolute) se
            // recortaba con un solo ítem. Los hijos van con padding, así que
            // las esquinas redondeadas no necesitan recorte.
            return (
              <div
                key={banda}
                className="rounded-[16px] border border-[rgba(138,100,255,0.12)] bg-[rgba(255,255,255,0.02)]"
              >
                {/* HEADER BANDA */}

                <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(138,100,255,0.08)]">
                  <p className="font-sora text-[14px] font-semibold capitalize text-text">
                    {labelBanda(banda)}
                  </p>

                  <p className="font-sora text-[14px] font-bold text-accent-light">
                    $
                    {totalBanda.toLocaleString(
                      "es-AR",
                    )}
                  </p>
                </div>

                {/* ITEMS */}

                <div className="flex flex-col px-4 py-1">
                  {items.map((i) => (
                    <FilaIngreso
                      key={i.id}
                      ingreso={i}
                      compact
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              </div>
            );
          },
        )}
      </div>
    </Acordeon>
  );
}