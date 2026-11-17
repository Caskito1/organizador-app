import Acordeon from "@/app/gastos/components/Acordeon";

import FilaIngreso from "../components/FilaIngreso";

import { UYU, sumarPorMoneda } from "../helpers/ingresosMoneda";

export default function OtrosSection({
  ingresos,
  open,
  onToggle,
  onEdit,
  onDelete,
}) {
  return (
    <Acordeon
      titulo="Otros"
      // 5.0: solo pesos (los ítems de esta sección se derivan a UYU).
      total={sumarPorMoneda(ingresos, UYU)}
      open={open}
      onToggle={onToggle}
      empty={!ingresos.length}
    >
      {ingresos.map((i) => (
        <FilaIngreso
          key={i.id}
          ingreso={i}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </Acordeon>
  );
}
