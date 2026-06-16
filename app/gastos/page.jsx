"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import useGastos from "./hooks/useGastos";

import GastosHeader from "./sections/GastosHeader";
import TotalMesCard from "./sections/TotalMesCard";
import PersonalSection from "./sections/PersonalSection";
import GroupSection from "./sections/GroupSection";
import GastosFijosSection from "./sections/GastosFijosSection";
import EditarGastoModal from "./components/EditarGastoModal";

import LoadingScreen from "@/app/components/ui/LoadingScreen";
import MonthSelectorModal from "./components/MonthNavigator";
import Appshell from "@/app/components/layout/Appshell";

export default function GastosPage() {
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  const {
    loading,
    loadingGroups,
    user,
    gastosPersonales,
    gastosPorGrupo,
    fixedCompartidos,
    fixedPersonales,
    totalFixed,
    totalGastos,
    totalTransacciones,
    openSection,
    toggleSection,
    editingGasto,
    setEditingGasto,
    editarGasto,
    eliminarGasto,
  } = useGastos(selectedMonth);

  if (loading || loadingGroups) {
    return <LoadingScreen text="Cargando gastos..." />;
  }

  return (
    <Appshell>
      <div className="max-w-[430px] mx-auto relative z-[1]">
        <GastosHeader
          router={router}
          mesActual={selectedMonth}
          onOpenCalendar={() => setCalendarOpen(true)}
        />

        <TotalMesCard
          totalGastos={totalGastos}
          totalTransacciones={totalTransacciones}
        />

        <div className="flex flex-col gap-[10px] mt-4 pb-10">
          <PersonalSection
            gastos={gastosPersonales}
            open={openSection === "personal"}
            onToggle={() => toggleSection("personal")}
            onEdit={setEditingGasto}
            onDelete={(g) => eliminarGasto(g.id)}
          />

          {gastosPorGrupo.map(({ grupo, gastos, totalGrupo, totalUsuario }) => (
            <GroupSection
              key={grupo.id}
              grupo={grupo}
              gastos={gastos}
              totalGrupo={totalGrupo}
              totalUsuario={totalUsuario}
              open={openSection === grupo.id}
              onToggle={() => toggleSection(grupo.id)}
              onEdit={setEditingGasto}
              onDelete={(g) => eliminarGasto(g.id)}
            />
          ))}

          <GastosFijosSection
            fixedCompartidos={fixedCompartidos}
            fixedPersonales={fixedPersonales}
            totalFixed={totalFixed}
            open={openSection === "fijos"}
            onToggle={() => toggleSection("fijos")}
          />
        </div>

        <MonthSelectorModal
          open={calendarOpen}
          value={selectedMonth}
          onClose={() => setCalendarOpen(false)}
          onSelect={(date) => setSelectedMonth(date)}
        />

        {editingGasto && (
          <EditarGastoModal
            gasto={editingGasto}
            onClose={() => setEditingGasto(null)}
            onSave={(payload) => editarGasto(editingGasto.id, payload)}
            onDelete={eliminarGasto}
          />
        )}
      </div>
    </Appshell>
  );
}