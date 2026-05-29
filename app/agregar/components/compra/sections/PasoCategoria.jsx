import SelectBtn from "@/app/components/ui/SectionBtn";
import { CATEGORIAS } from "@/lib/taxonomia";



export default function PasoCategoria({
  catId,
  seleccionarCategoria,
}) {
  return (
<div className="grid grid-cols-2 gap-2">
      {Object.entries(
        CATEGORIAS,
      ).map(([id, cat]) => (
        <SelectBtn
          key={id}
          label={cat.label}
          active={catId === id}
          onClick={() =>
            seleccionarCategoria(id)
          }
        />
      ))}
    </div>
  );
}