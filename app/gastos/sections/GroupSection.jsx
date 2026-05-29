import { log } from "firebase/firestore/pipelines";
import Acordeon from "../components/Acordeon";
import FilaGasto from "../components/FilaGasto";

export default function GroupSection({
  grupo,
  gastos,

  totalGrupo,
  totalUsuario,

  open,
  onToggle,
}) {
  
  return (
<Acordeon
  titulo={grupo.name}
  total={totalGrupo}
  subtitle={`Tu parte: $${Number(
    totalUsuario,
  ).toLocaleString("es-AR")}`}
  open={open}
  onToggle={onToggle}
  empty={gastos.length === 0}
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