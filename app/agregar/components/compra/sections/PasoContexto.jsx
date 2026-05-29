import SelectBtn from "@/app/components/ui/SectionBtn";
import { CONTEXTOS } from "@/lib/taxonomia";


export default function PasoContexto({
  contexto,
  seleccionarContexto,
}) {
  return (
 <div className="flex flex-col gap-2">
      {CONTEXTOS.map((c) => (
        <SelectBtn
          key={c.id}
          label={c.label}
          active={contexto?.id === c.id}
          onClick={() =>
            seleccionarContexto(c)
          }
        />
      ))}
    </div>
  );
}