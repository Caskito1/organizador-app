import Acordeon from "@/app/gastos/components/Acordeon";

import FilaIngreso from "../components/FilaIngreso";

export default function SueldoSection({
  ingresos,
  open,
  onToggle,
}) {
    
    
  return (
    <Acordeon
      titulo="Sueldo"
      total={ingresos.reduce(
        (a, i) =>
          a + Number(i.monto || 0),
        0,
      )}
      open={open}
      onToggle={onToggle}
    >
      {ingresos.map((i) => (
        <FilaIngreso
          key={i.id}
          ingreso={i}
        />
      ))}
    </Acordeon>
  );
}