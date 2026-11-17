import Acordeon from "@/app/gastos/components/Acordeon";

import FilaIngreso from "../components/FilaIngreso";

// Fuente unica de los labels. Los ids son los canonicos que escribe
// useModoIngreso y no se cambian. Duplicado por decision de alcance
// de 2.3: no se extrae a una taxonomia compartida.
import { BANDAS } from "@/app/agregar/components/ingresos/hooks/useModoIngreso";
import {
  UYU,
  monedaDeSubtipo,
  simboloDe,
  sumarPorMoneda,
} from "../helpers/ingresosMoneda";

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

  // 5.0: los totales suman SOLO pesos (los ítems de esta sección se derivan a
  // UYU por subtipo). El símbolo sale de la moneda del grupo, no del tipo.
  const totalGeneral = sumarPorMoneda(ingresos, UYU);

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
            const monedaBanda =
              monedaDeSubtipo(banda);
            const simbolo =
              simboloDe(monedaBanda);
            const totalBanda =
              sumarPorMoneda(
                items,
                monedaBanda,
              );

            return (
              <div
                key={banda}
                className="rounded-[16px] border border-[rgba(138,100,255,0.12)] bg-[rgba(255,255,255,0.02)] overflow-hidden"
              >
                {/* HEADER BANDA */}

                <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(138,100,255,0.08)]">
                  <p className="font-sora text-[14px] font-semibold capitalize text-text">
                    {labelBanda(banda)}
                  </p>

                  <p className="font-sora text-[14px] font-bold text-accent-light">
                    {simbolo}
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