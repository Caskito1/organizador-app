"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import useGastos from "./hooks/useGastos";

import GastosHeader from "./sections/GastosHeader";
import TotalMesCard from "./sections/TotalMesCard";
import PersonalSection from "./sections/PersonalSection";
import GroupSection from "./sections/GroupSection";

import LoadingScreen from "@/app/components/ui/LoadingScreen";
import MonthSelectorModal from "./components/MonthNavigator";
import Appshell from "@/app/components/layout/Appshell";

export default function GastosPage() {
  const router = useRouter();

  const [selectedMonth, setSelectedMonth] =
    useState(new Date());

  const [calendarOpen, setCalendarOpen] =
    useState(false);

  const {
    loading,
    loadingGroups,

    gastosPersonales,
    gastosPorGrupo,

    totalGastos,
    totalTransacciones,

    openSections,
    toggleSection,
  } = useGastos(selectedMonth);

  if (loading || loadingGroups) {
    return (
      <LoadingScreen text="Cargando gastos..." />
    );
  }

  return (
    <Appshell>
      <div className="max-w-[430px] mx-auto relative z-[1]">
        <GastosHeader
          router={router}
          mesActual={selectedMonth}
          onOpenCalendar={() =>
            setCalendarOpen(true)
          }
        />

        <TotalMesCard
          totalGastos={totalGastos}
          totalTransacciones={
            totalTransacciones
          }
        />

        <div className="flex flex-col gap-[10px] mt-4">
          {/* PERSONALES */}
          <PersonalSection
            gastos={gastosPersonales}
            total={gastosPersonales.reduce(
              (acc, g) =>
                acc +
                Number(g.monto || 0),
              0,
            )}
            open={openSections.personal}
            onToggle={() =>
              toggleSection("personal")
            }
          />

          {/* GRUPOS */}
          {gastosPorGrupo.map(
            ({
    grupo,
    gastos,
    totalGrupo,
    totalUsuario,
  }) => (
              <GroupSection
                key={grupo.id}
                grupo={grupo}
                gastos={gastos}
                totalGrupo={totalGrupo}
                totalUsuario={totalUsuario}
                open={
                  openSections[
                    grupo.id
                  ] ?? false
                }
                onToggle={() =>
                  toggleSection(
                    grupo.id,
                  )
                }
              />
            ),
          )}
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