// reintegros/sections/ReintegrosHeader.jsx
// 4.3a — Barra superior de /reintegros (BackBtn + título), extraída de la
// page en la reescritura de 4.3. Sin selector de mes: el mes solo aplica a
// «Dinero del mes» (decisión de 4.2).

"use client";

import { useRouter } from "next/navigation";

import BackBtn from "../../components/ui/BackBtn";

export default function ReintegrosHeader() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between pb-2 pt-14">
      <div className="flex items-center gap-3">
        <BackBtn onClick={() => router.back()} />
        <h1 className="font-display text-[20px] font-bold capitalize tracking-[-0.4px] text-text">
          Reintegros
        </h1>
      </div>
    </div>
  );
}
