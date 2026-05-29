import Acordeon from "../components/Acordeon";
import FilaGasto from "../components/FilaGasto";

export default function PersonalSection({
  gastos,
  open,
  onToggle,
}) {
  const total = gastos.reduce(
    (a, g) =>
      a + Number(g.monto || 0),
    0,
  );

  return (
    <Acordeon
      titulo="Gastos Personales"
      total={total}
      open={open}
      onToggle={onToggle}
      empty={!gastos.length}
    >
      {gastos.map((g) => (
        <FilaGasto
          key={g.id}
          gasto={g}
          usuarioNombre={
            g.usuarioNombre
          }
        />
      ))}
    </Acordeon>
  );
}