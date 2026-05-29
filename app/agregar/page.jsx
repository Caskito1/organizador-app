"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import ModoUnico from "./components/ModoUnico";
import ModoCompra from "./components/ModoCompra";
import ModoTransferencia from "./components/ModoTransferencia";
import ModoIngreso from "./components/ModoIngreso";

import BackBtn from "../components/ui/BackBtn";

import Appshell from "../components/layout/Appshell";
import SectionBlock from "../components/layout/SectionBlock";

export default function Agregar() {
  const router = useRouter();

  const [modo, setModo] = useState(null);

  return (
    <Appshell>
      {!modo && (
        <>
          {/* Header */}
          <div className="flex items-center gap-3 pt-14">
            <BackBtn onClick={() => router.back()} />

            <h1 className="font-sora text-[18px] font-bold tracking-[-0.4px] text-text">
              Agregar
            </h1>
          </div>

          {/* Step line */}
          <div className="mb-6 mt-4">
            <div className="h-[3px] rounded-full bg-[rgba(138,100,255,0.15)]" />
          </div>

          {/* GASTOS */}
          <SectionBlock className="gap-3">
            <div className="mb-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-text-muted">
                Gastos
              </p>

              <p className="mt-[2px] text-[13px] text-text-muted">
                Registrá egresos personales o compartidos.
              </p>
            </div>

            {/* Gasto único */}
            <button
              onClick={() => setModo("unico")}
              className="w-full rounded-[18px] border border-[rgba(138,100,255,0.3)] bg-glass px-5 py-5 text-left backdrop-blur-[16px] transition-all duration-200 hover:border-accent2"
            >
              <p className="mb-1 font-sora text-[15px] font-bold text-text">
                Gasto único
              </p>

              <p className="text-[13px] leading-[1.5] text-text-muted">
                Un solo producto o servicio con su monto.
              </p>
            </button>

            {/* Compra rápida */}
            <button
              onClick={() => setModo("compra")}
              className="w-full rounded-[18px] border border-[rgba(138,100,255,0.3)] bg-glass px-5 py-5 text-left backdrop-blur-[16px] transition-all duration-200 hover:border-accent2"
            >
              <p className="mb-1 font-sora text-[15px] font-bold text-text">
                Compra rápida
              </p>

              <p className="text-[13px] leading-[1.5] text-text-muted">
                Varios productos de una sola vez.
              </p>
            </button>

            {/* Transferencia */}
            <button
              onClick={() => setModo("transferencia")}
              className="w-full rounded-[18px] border border-[rgba(138,100,255,0.3)] bg-glass px-5 py-5 text-left backdrop-blur-[16px] transition-all duration-200 hover:border-accent2"
            >
              <p className="mb-1 font-sora text-[15px] font-bold text-text">
                Transferencia
              </p>

              <p className="text-[13px] leading-[1.5] text-text-muted">
                Registrá un pago entre integrantes del grupo.
              </p>
            </button>
          </SectionBlock>

          {/* Separador */}
          <div className="my-6 h-px bg-[rgba(255,255,255,0.06)]" />

          {/* INGRESOS */}
          <SectionBlock className="gap-3">
            <div className="mb-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-text-muted">
                Ingresos
              </p>

              <p className="mt-[2px] text-[13px] text-text-muted">
                Registrá entradas de dinero personales.
              </p>
            </div>

            {/* Nuevo ingreso */}
            <button
              onClick={() => setModo("ingreso")}
              className="w-full rounded-[18px] border border-[rgba(94,224,197,0.25)] bg-[rgba(94,224,197,0.06)] px-5 py-5 text-left backdrop-blur-[16px] transition-all duration-200 hover:border-[rgba(94,224,197,0.45)]"
            >
              <p className="mb-1 font-sora text-[15px] font-bold text-text">
                Agregar ingreso
              </p>

              <p className="text-[13px] leading-[1.5] text-text-muted">
                Sueldo, bandas, freelance y otros ingresos.
              </p>
            </button>
          </SectionBlock>
        </>
      )}

      {modo === "unico" && (
        <ModoUnico onBack={() => setModo(null)} />
      )}

      {modo === "compra" && (
        <ModoCompra onBack={() => setModo(null)} />
      )}

      {modo === "transferencia" && (
        <ModoTransferencia onBack={() => setModo(null)} />
      )}

      {modo === "ingreso" && (
        <ModoIngreso onBack={() => setModo(null)} />
      )}
    </Appshell>
  );
}