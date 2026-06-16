"use client";

import { useState } from "react";
import FixedExpenseCard from "../components/FixedExpenseCard";
import AgregarGastoFijoModal from "../components/AgregarGastoFijoModal";

export default function PersonalesSection({
  gastos,
  catalogoDisponible,
  openItems,
  toggleItem,
  registrarGasto,
  registrarPago,
  agregarGastoPersonal,
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] uppercase tracking-[0.5px] text-text-muted font-medium">
          Personales
        </p>
        {catalogoDisponible.length > 0 && (
          <button
            onClick={() => setModalOpen(true)}
            className="text-[12px] font-semibold text-accent-light border border-accent/30 rounded-full px-3 py-[3px] hover:bg-accent/10 transition-all"
          >
            + Agregar
          </button>
        )}
      </div>

      {gastos.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-border px-4 py-5 text-center">
          <p className="text-[13px] text-text-muted">No tenés gastos personales configurados</p>
          <button
            onClick={() => setModalOpen(true)}
            className="mt-2 text-[13px] font-semibold text-accent-light"
          >
            Agregar el primero
          </button>
        </div>
      ) : (
        gastos.map((gasto) => (
          <FixedExpenseCard
            key={gasto.id}
            gasto={gasto}
            open={openItems[gasto.id] ?? false}
            onToggle={() => toggleItem(gasto.id)}
            registrarGasto={registrarGasto}
            registrarPago={registrarPago}
          />
        ))
      )}

      {modalOpen && (
        <AgregarGastoFijoModal
          catalogo={catalogoDisponible}
          onClose={() => setModalOpen(false)}
          onSave={agregarGastoPersonal}
        />
      )}
    </div>
  );
}