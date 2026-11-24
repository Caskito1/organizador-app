// app/balances/page.jsx
// Página /balances (5.2): la lectura mensual completa. Consume el servicio de
// 5.1 y agrega la cadena de saldos (caja al inicio / real al cierre).

"use client";

import { useState } from "react";

import Appshell from "@/app/components/layout/Appshell";
import MonthNavigator from "@/app/gastos/components/MonthNavigator";

import useBalances from "./hooks/useBalances";
import BalancesHeader from "./sections/BalancesHeader";
import CajaDelMesCard from "./sections/CajaDelMesCard";
import ContrasteCard from "./sections/ContrasteCard";
import PendientesCard from "./sections/PendientesCard";
import TendenciaSection from "./sections/TendenciaSection";
import DetalleSection from "./sections/DetalleSection";
import InversionesModal from "./components/InversionesModal";
import CajaModal from "./components/CajaModal";

export default function BalancesPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [openSection, setOpenSection] = useState(null);
  const [modal, setModal] = useState(null);

  const b = useBalances(selectedMonth);

  const listo = !b.loading && !b.error && b.fila && b.detalle;

  return (
    <Appshell>
      <div className="mx-auto max-w-[430px] relative z-[1]">
        <BalancesHeader
          mes={b.mes}
          esEnCurso={b.esEnCurso}
          onOpenCalendar={() => setCalendarOpen(true)}
        />

        {b.loading && (
          <p className="text-[13px] text-text-muted">Cargando balance…</p>
        )}

        {!b.loading && b.error && (
          <div className="rounded-[12px] border border-negative/30 bg-negative/10 px-4 py-3 text-[13px] text-negative">
            <p>No se pudo cargar el balance.</p>

            <button
              type="button"
              onClick={b.recargar}
              className="mt-2 cursor-pointer rounded-[12px] border border-negative/40 px-3 py-[6px] text-[12px] font-semibold text-negative transition-all hover:bg-negative/10"
            >
              Reintentar
            </button>
          </div>
        )}

        {listo && (
          <div className="mt-4 flex flex-col gap-[10px] pb-10">
            <CajaDelMesCard
              fila={b.fila}
              onInversiones={() => setModal({ tipo: "inversiones" })}
              onAncla={() => setModal({ tipo: "inicio" })}
            />

            <ContrasteCard
              fila={b.fila}
              esEnCurso={b.esEnCurso}
              onCierre={() => setModal({ tipo: "cierre" })}
            />

            <PendientesCard
              stock={b.fila.balance.stock}
              esEnCurso={b.esEnCurso}
            />

            <TendenciaSection filas={b.filas} metricas={b.metricas} />

            <DetalleSection
              detalle={b.detalle}
              balance={b.fila.balance}
              openSection={openSection}
              onToggle={(clave) =>
                setOpenSection((previo) =>
                  previo === clave ? null : clave,
                )
              }
            />
          </div>
        )}
      </div>

      <MonthNavigator
        open={calendarOpen}
        value={selectedMonth}
        onClose={() => setCalendarOpen(false)}
        onSelect={setSelectedMonth}
        yearNavigation
        maxMonth={new Date()}
      />

      {modal?.tipo === "inversiones" && (
        <InversionesModal
          inicial={b.prefsMes}
          guardando={b.guardando}
          onClose={() => setModal(null)}
          onGuardar={async (valores) => {
            await b.guardarInversiones(valores);
            setModal(null);
          }}
        />
      )}

      {modal && modal.tipo !== "inversiones" && (
        <CajaModal
          modo={modal.tipo}
          inicial={
            modal.tipo === "inicio"
              ? b.prefsMes?.cajaAlInicio
              : b.prefsMes?.cajaRealAlCierre
          }
          guardando={b.guardando}
          onClose={() => setModal(null)}
          onGuardar={async (monto) => {
            if (modal.tipo === "inicio") {
              await b.guardarCajaAlInicio(monto);
            } else {
              await b.guardarCajaReal(monto);
            }

            setModal(null);
          }}
        />
      )}
    </Appshell>
  );
}
