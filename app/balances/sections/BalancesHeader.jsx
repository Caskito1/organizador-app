// balances/sections/BalancesHeader.jsx
// Header de /balances: volver + título + mes (con «en curso») + calendario.

"use client";

import { useRouter } from "next/navigation";

import BackBtn from "@/app/components/ui/BackBtn";
import IconButton from "@/app/components/ui/IconButton";
import IconCalendar from "@/app/components/icons/IconCalendar";

import { etiquetaConCurso } from "../helpers/formato";

export default function BalancesHeader({ mes, esEnCurso, onOpenCalendar }) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between pb-2 pt-14">
      <div className="flex items-center gap-3">
        <BackBtn onClick={() => router.back()} />

        <div className="min-w-0">
          <h1 className="font-display text-[20px] font-bold tracking-[-0.4px] text-text">
            Balances
          </h1>
          <p className="mt-[2px] text-[11px] capitalize text-text-muted">
            {etiquetaConCurso(mes, esEnCurso)}
          </p>
        </div>
      </div>

      <IconButton onClick={onOpenCalendar}>
        <IconCalendar />
      </IconButton>
    </div>
  );
}
