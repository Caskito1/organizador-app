// tarjetas/sections/ComprasCicloCard.jsx
// Compras del ciclo (6.2, §12.6).

"use client";

import GlassCard from "@/app/components/layout/GlassCard";

import FilaCompra from "../components/FilaCompra";

export default function ComprasCicloCard({ comprasCiclo, esEditable, onMenu }) {
  return (
    <GlassCard>
      <p className="text-[13px] font-semibold text-text">Compras del ciclo</p>

      {comprasCiclo.length === 0 ? (
        <p className="mt-3 text-[12px] text-text-muted">
          Sin datos de este mes.
        </p>
      ) : (
        <div className="mt-2">
          {comprasCiclo.map(({ compra, cuota }) => (
            <FilaCompra
              key={compra.id}
              compra={compra}
              cuota={cuota}
              editable={esEditable(compra)}
              onMenu={onMenu}
            />
          ))}
        </div>
      )}
    </GlassCard>
  );
}
