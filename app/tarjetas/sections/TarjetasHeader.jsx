// tarjetas/sections/TarjetasHeader.jsx
// Header de /tarjetas: volver + título + ajustes + calendario (6.2, §12.4).

"use client";

import { useRouter } from "next/navigation";

import BackBtn from "@/app/components/ui/BackBtn";
import IconButton from "@/app/components/ui/IconButton";
import IconCalendar from "@/app/components/icons/IconCalendar";

import BotonOpciones from "../components/BotonOpciones";

export default function TarjetasHeader({ nombre, onEditarConfig, onOpenCalendar }) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between pb-2 pt-14">
      <div className="flex items-center gap-3">
        <BackBtn onClick={() => router.back()} />

        <div className="min-w-0">
          <h1 className="font-display text-[20px] font-bold tracking-[-0.4px] text-text">
            Tarjetas
          </h1>
          <p className="mt-[2px] text-[11px] text-text-muted">
            {nombre || "Sin configurar"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {onEditarConfig && (
          <BotonOpciones etiqueta="Ajustes de la tarjeta" onClick={onEditarConfig} />
        )}
        <IconButton onClick={onOpenCalendar}>
          <IconCalendar />
        </IconButton>
      </div>
    </div>
  );
}
