import Acordeon from "@/app/gastos/components/Acordeon";

import FilaIngreso from "../components/FilaIngreso";

export default function FreelanceSection({
  ingresos,
  open,
  onToggle,
  onEdit,
  onDelete,
}) {
  return (
    <Acordeon
      titulo="Freelance"
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
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </Acordeon>
  );
}