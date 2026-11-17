import Acordeon from "@/app/gastos/components/Acordeon";

import FilaIngreso from "../components/FilaIngreso";

import {
  UYU,
  USD,
  agruparSueldoPorSubtipo,
  monedaDeSubtipo,
  simboloDe,
  sumarPorMoneda,
} from "../helpers/ingresosMoneda";

// 5.0 (D-8) — Sueldo agrupado por subtipo con el patrón de BandasSection:
// un bloque por subtipo con su subtotal y sus filas, solo grupos con ítems.
//   · El subtotal del acordeón queda en PESOS: los dólares se leen en su
//     propio grupo («Sueldo en dólares», con símbolo US$).
//   · El grupo legacy sin subtipo («Sueldo») va al final (P-5/A-2) y cuenta
//     como UYU por derivación (monedaDeSubtipo(null) → UYU).
export default function SueldoSection({
  ingresos,
  open,
  onToggle,
  onEdit,
  onDelete,
}) {
  const grupos = agruparSueldoPorSubtipo(ingresos);
  const totalUSD = sumarPorMoneda(ingresos, USD);

  return (
    <Acordeon
      titulo="Sueldo"
      total={sumarPorMoneda(ingresos, UYU)}
      // 5.0: el total del acordeón queda en PESOS (D-8) y los dólares se
      // muestran como subtítulo, con su símbolo, solo si existen.
      subtitle={
        totalUSD > 0
          ? `US$ ${totalUSD.toLocaleString("es-AR")}`
          : undefined
      }
      open={open}
      onToggle={onToggle}
      empty={!ingresos.length}
    >
      <div className="flex flex-col gap-3">
        {grupos.map((grupo) => {
          const moneda = monedaDeSubtipo(grupo.id);
          const simbolo = simboloDe(moneda);
          const subtotal = sumarPorMoneda(grupo.items, moneda);

          return (
            <div
              key={grupo.id ?? "legacy"}
              className="rounded-[16px] border border-[rgba(138,100,255,0.12)] bg-[rgba(255,255,255,0.02)] overflow-hidden"
            >
              {/* HEADER DEL SUBTIPO */}

              <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(138,100,255,0.08)]">
                <p className="font-sora text-[14px] font-semibold capitalize text-text">
                  {grupo.label}
                </p>

                <p className="font-sora text-[14px] font-bold text-accent-light">
                  {simbolo}
                  {subtotal.toLocaleString(
                    "es-AR",
                  )}
                </p>
              </div>

              {/* ITEMS */}

              <div className="flex flex-col px-4 py-1">
                {grupo.items.map((i) => (
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
        })}
      </div>
    </Acordeon>
  );
}
