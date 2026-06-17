"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Appshell from "@/app/components/layout/Appshell";
import LoadingScreen from "@/app/components/ui/LoadingScreen";
import MonthSelectorModal from "@/app/gastos/components/MonthNavigator";

import useFixedExpenses from "./hooks/useFixedExpenses";

import FixedExpensesHeader from "./sections/FixedExpensesHeader";
import BalanceMesCard from "./sections/BalanceMesCard";
import CompartidosSection from "./sections/CompartidosSection";
import PersonalesSection from "./sections/PersonalesSection";

export default function GastosFijosPage() {
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  const {
    loading,
    loadingGroups,
    grupo,
    gastosCompartidos,
    gastosPersonales,
    catalogoDisponible,
    balanceNeto,
    itemsQueDebo,
    itemsQueDebenAMi,
    totalCompartido,
    miTotalCompartido,
    totalPersonal,
    openItems,
    toggleItem,
    agregarGastoPersonal,
    registrarGasto,
    registrarPago,
    saldarPendiente,
    saldarMes,
    user,
  } = useFixedExpenses(selectedMonth);

  if (loading || loadingGroups) {
    return <LoadingScreen text="Cargando gastos fijos..." />;
  }

  return (
    <Appshell>
      <div className="max-w-[430px] mx-auto relative z-[1]">
        <FixedExpensesHeader
          router={router}
          mesActual={selectedMonth}
          onOpenCalendar={() => setCalendarOpen(true)}
        />

        <BalanceMesCard
          balanceNeto={balanceNeto}
          totalCompartido={totalCompartido}
          miTotalCompartido={miTotalCompartido}
          totalPersonal={totalPersonal}
          grupo={grupo}
          itemsQueDebo={itemsQueDebo}
          itemsQueDebenAMi={itemsQueDebenAMi}
          saldarMes={saldarMes}
        />

        <div className="flex flex-col gap-[10px] mt-4 pb-10">
          <CompartidosSection
            gastos={gastosCompartidos}
            openItems={openItems}
            toggleItem={toggleItem}
            registrarGasto={registrarGasto}
            registrarPago={registrarPago}
            saldarPendiente={saldarPendiente}
            userId={user?.uid}
          />

          <PersonalesSection
            gastos={gastosPersonales}
            catalogoDisponible={catalogoDisponible}
            openItems={openItems}
            toggleItem={toggleItem}
            registrarGasto={registrarGasto}
            registrarPago={registrarPago}
            agregarGastoPersonal={agregarGastoPersonal}
          />
        </div>

        <MonthSelectorModal
          open={calendarOpen}
          value={selectedMonth}
          onClose={() => setCalendarOpen(false)}
          onSelect={(date) => setSelectedMonth(date)}
        />
      </div>
    </Appshell>
  );
}