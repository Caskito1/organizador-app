"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import useIngresos from "./hooks/useIngresos";

import IngresosHeader from "./sections/IngresosHeader";
import TotalIngresosCard from "./sections/TotalIngresosCard";

import SueldoSection from "./sections/SueldoSection";
import BandasSection from "./sections/BandasSection";
import FreelanceSection from "./sections/FreelanceSection";
import TransferenciasIngresosSection from "./sections/TransferenciasIngresosSection";

import LoadingScreen from "@/app/components/ui/LoadingScreen";
import MonthSelectorModal from "@/app/gastos/components/MonthNavigator";

import Appshell from "@/app/components/layout/Appshell";

export default function IngresosPage() {
  const router = useRouter();

  const [selectedMonth, setSelectedMonth] =
    useState(new Date());

  const [calendarOpen, setCalendarOpen] =
    useState(false);

  const {
    loading,

    ingresosSueldo,
    ingresosBandas,
    ingresosFreelance,

    transferenciasRecibidas,

    totalIngresos,

    openSections,
    toggleSection,
  } = useIngresos(selectedMonth);

  if (loading) {
    return (
      <LoadingScreen text="Cargando ingresos..." />
    );
  }

  return (
    <Appshell>
      <div className="relative z-[1] mx-auto max-w-[430px]">

        <IngresosHeader
          router={router}
          mesActual={selectedMonth}
          onOpenCalendar={() =>
            setCalendarOpen(true)
          }
        />

        <TotalIngresosCard
          totalIngresos={totalIngresos}
          totalTransacciones={
            ingresosSueldo.length +
            ingresosBandas.length +
            ingresosFreelance.length +
            transferenciasRecibidas.length
          }
        />

        <div className="mt-4 flex flex-col gap-[10px]">

          <SueldoSection
            ingresos={ingresosSueldo}
            open={openSections.sueldo}
            onToggle={() =>
              toggleSection("sueldo")
            }
          />

          <BandasSection
            ingresos={ingresosBandas}
            open={openSections.bandas}
            onToggle={() =>
              toggleSection("bandas")
            }
          />

          <FreelanceSection
            ingresos={ingresosFreelance}
            open={openSections.freelance}
            onToggle={() =>
              toggleSection("freelance")
            }
          />

          <TransferenciasIngresosSection
            transferencias={
              transferenciasRecibidas
            }
            open={
              openSections.transferencias
            }
            onToggle={() =>
              toggleSection(
                "transferencias",
              )
            }
          />
        </div>

        <MonthSelectorModal
          open={calendarOpen}
          value={selectedMonth}
          onClose={() =>
            setCalendarOpen(false)
          }
          onSelect={(date) =>
            setSelectedMonth(date)
          }
        />
      </div>
    </Appshell>
  );
}